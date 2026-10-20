import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const BASE_URL = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
export const KONBINI_MODEL_URL = `${BASE_URL}models/rainy-konbini.glb`;
export const KONBINI_DRACO_PATH = `${BASE_URL}draco/`;

/** Materials that need their own live mesh (animated, transparent or shader-driven). */
const ROLE_BY_MATERIAL = {
  Glass: "glass",
  FreezerGlass: "glass",
  Puddle: "puddle",
  Sign: "sign",
  SignB: "sign",
  TL_G: "signal-green",
  TL_Y: "signal-yellow",
  TL_R: "signal-red",
};
const ANIMATED_NODE_PREFIXES = ["DoorL", "DoorR"];
const NO_OUTLINE = new Set(["glass", "puddle"]);

export function classifyKonbiniMaterial(name = "") {
  const base = String(name).replace(/[._]\d+$/, "");
  return ROLE_BY_MATERIAL[base] ?? "static";
}

export function isAnimatedKonbiniNode(name = "") {
  return ANIMATED_NODE_PREFIXES.some((prefix) => name === prefix);
}

export function shouldOutline(role, size) {
  return !NO_OUTLINE.has(role) && size >= 0.06;
}

/** Three-step cel gradient (shadow / mid / lit), nearest-filtered. */
export function createToonGradient() {
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function readMaterialTone(material) {
  const extras = material?.userData ?? {};
  const color = Array.isArray(extras.tt_color) && extras.tt_color.length >= 3
    ? extras.tt_color
    : [material?.color?.r ?? 0.8, material?.color?.g ?? 0.8, material?.color?.b ?? 0.8];
  const emit = Number(extras.tt_emit) || 0;
  return { color, emit };
}

function makeSurfaceMaterial(source, role, gradientMap, registry) {
  const { color, emit } = readMaterialTone(source);
  const base = new THREE.Color().setRGB(color[0], color[1], color[2], THREE.LinearSRGBColorSpace);
  let material;
  if (role === "glass") {
    material = new THREE.MeshBasicMaterial({
      color: 0x9fc7e8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide,
    });
  } else {
    material = new THREE.MeshToonMaterial({ color: base, gradientMap });
    if (emit > 0) {
      material.emissive = base.clone();
      material.emissiveIntensity = Math.min(2.4, 0.35 + emit * 0.4);
    }
  }
  material.name = source?.name ?? role;
  material.userData.baseEmissive = material.emissiveIntensity ?? 0;
  return registry.trackMaterial(material);
}

function stripToPositionNormal(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const key of Object.keys(g.attributes)) {
    if (key !== "position" && key !== "normal") g.deleteAttribute(key);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  return g;
}

export function createOutlineMaterial(thickness = 0.018) {
  return new THREE.ShaderMaterial({
    uniforms: { uThickness: { value: thickness }, uColor: { value: new THREE.Color(0x0a0c18) } },
    vertexShader: `uniform float uThickness;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        float scale = uThickness * clamp(-mv.z * 0.08, 0.6, 2.2);
        mv.xyz += n * scale;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
}

/**
 * Turns the raw glTF scene into an optimised toon diorama: static meshes are
 * merged per material (few draw calls) and receive inverted-hull outlines;
 * animated / special meshes stay live and are returned as `parts`.
 */
export function buildKonbiniDiorama(gltfScene, registry) {
  const root = new THREE.Group();
  root.name = "KonbiniDiorama";
  const gradientMap = registry.trackTexture(createToonGradient());
  const outlineMaterial = registry.trackMaterial(createOutlineMaterial());
  const materialCache = new Map();
  const staticBuckets = new Map();
  const outlineGeoms = [];
  const parts = { doors: {}, signs: [], signals: { green: [], yellow: [], red: [] }, puddles: [], glass: [] };
  const size = new THREE.Vector3();

  gltfScene.updateMatrixWorld(true);
  const surface = (src, role) => {
    const key = `${src?.name}|${role}`;
    if (!materialCache.has(key)) materialCache.set(key, makeSurfaceMaterial(src, role, gradientMap, registry));
    return materialCache.get(key);
  };

  const animatedRoots = [];
  gltfScene.traverse((node) => { if (isAnimatedKonbiniNode(node.name)) animatedRoots.push(node); });
  const insideAnimated = (node) => {
    for (let p = node; p; p = p.parent) if (animatedRoots.includes(p)) return p;
    return null;
  };

  const meshes = [];
  gltfScene.traverse((node) => { if (node.isMesh) meshes.push(node); });

  for (const mesh of meshes) {
    const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const role = classifyKonbiniMaterial(src?.name);
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getSize(size).multiply(mesh.getWorldScale(new THREE.Vector3()));
    const extent = Math.max(size.x, size.y, size.z);
    const owner = insideAnimated(mesh);

    if (role === "static" && !owner) {
      const g = stripToPositionNormal(mesh.geometry).applyMatrix4(mesh.matrixWorld);
      const bucketKey = src?.name ?? "default";
      if (!staticBuckets.has(bucketKey)) staticBuckets.set(bucketKey, { src, geoms: [] });
      staticBuckets.get(bucketKey).geoms.push(g);
      if (shouldOutline(role, extent)) outlineGeoms.push(g);
      continue;
    }

    const material = surface(src, role);
    const live = new THREE.Mesh(registry.trackGeometry(mesh.geometry), material);
    live.name = mesh.name;
    mesh.matrixWorld.decompose(live.position, live.quaternion, live.scale);
    if (shouldOutline(role, extent)) {
      const outline = new THREE.Mesh(live.geometry, outlineMaterial);
      outline.renderOrder = -1;
      live.add(outline);
    }
    if (owner) {
      const doorKey = owner.name;
      if (!parts.doors[doorKey]) {
        const group = new THREE.Group();
        group.name = doorKey;
        group.userData.restX = 0;
        root.add(group);
        parts.doors[doorKey] = group;
      }
      parts.doors[doorKey].add(live);
    } else {
      root.add(live);
    }
    if (role === "sign") parts.signs.push(live);
    if (role === "puddle") parts.puddles.push(live);
    if (role === "glass") { parts.glass.push(live); live.renderOrder = 2; }
    if (role.startsWith("signal-")) parts.signals[role.slice(7)].push(live);
  }

  for (const { src, geoms } of staticBuckets.values()) {
    const merged = registry.trackGeometry(mergeGeometries(geoms, false));
    const mesh = new THREE.Mesh(merged, surface(src, "static"));
    mesh.name = `static:${src?.name}`;
    root.add(mesh);
  }
  if (outlineGeoms.length) {
    const outlineGeometry = registry.trackGeometry(mergeGeometries(outlineGeoms, false));
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.name = "outlines";
    outline.renderOrder = -1;
    root.add(outline);
  }
  for (const { geoms } of staticBuckets.values()) geoms.forEach((g) => g.dispose());

  // Drop the raw glTF resources we did not adopt.
  const adopted = new Set(registry.geometries);
  gltfScene.traverse((node) => {
    if (!node.isMesh) return;
    if (!adopted.has(node.geometry)) node.geometry.dispose();
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((m) => {
      Object.values(m ?? {}).forEach((v) => v?.isTexture && v.dispose());
      m?.dispose?.();
    });
  });

  return { root, parts, materialsByName: materialCache };
}

export function loadKonbiniModel({ url = KONBINI_MODEL_URL, dracoPath = KONBINI_DRACO_PATH } = {}) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(dracoPath);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader.loadAsync(url).finally(() => draco.dispose());
}
