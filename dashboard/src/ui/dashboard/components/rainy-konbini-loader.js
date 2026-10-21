import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const BASE_URL = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
export const KONBINI_MODEL_URL = `${BASE_URL}models/rainy-konbini.glb`;
export const DAY_KONBINI_MODEL_URL = `${BASE_URL}models/day-konbini.glb`;
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
  return !NO_OUTLINE.has(role) && size >= 0.015;
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

function makeSurfaceMaterial(source, role, gradientMap, registry, override = null) {
  const tone = readMaterialTone(source);
  const color = override ?? tone.color;
  const { emit } = tone;
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

export function createOutlineMaterial(widthPx = 2.2) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWidth: { value: widthPx },
      uResolution: { value: new THREE.Vector2(1600, 900) },
      uColor: { value: new THREE.Color(0x0a0c18) },
    },
    vertexShader: `uniform float uWidth; uniform vec2 uResolution;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vec4 clip = projectionMatrix * mv;
        vec4 clipN = projectionMatrix * vec4(mv.xyz + n * 0.05, 1.0);
        vec2 d = clipN.xy / clipN.w - clip.xy / clip.w;
        float len = length(d);
        if (len > 1e-6) {
          clip.xy += (d / len) * (uWidth * 2.0 / uResolution) * clip.w;
        }
        // nudge hull behind the surface so it never covers the front face
        clip.z += 0.0004 * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
}

/** Neutral palette overrides so the night light reads as cool, not lavender/pink. */
const MATERIAL_OVERRIDES = {
  Wall: [0.78, 0.72, 0.6],
  Neighbor: [0.5, 0.5, 0.48],
  BackBld: [0.36, 0.37, 0.38],
};
const NODE_OVERRIDES = {
  Roof: [0.16, 0.17, 0.19],
  NeighborWall: [0.42, 0.42, 0.4],
  BackBuilding: [0.3, 0.31, 0.32],
};

export function toneOverrideFor(nodeName = "", materialName = "") {
  const node = String(nodeName).replace(/\d+$/, "");
  return NODE_OVERRIDES[node] ?? MATERIAL_OVERRIDES[materialName] ?? null;
}

export const HEIGHT_FIELD = { size: 96, extent: 6.4 };

/**
 * Rasterises the top of every sizeable roof-like mesh into an XZ height map so
 * rain can stop on roofs, awnings, signs and neighbouring buildings.
 */
export function createHeightField(boxes, { size = HEIGHT_FIELD.size, extent = HEIGHT_FIELD.extent } = {}) {
  const data = new Float32Array(size * size);
  const cell = (2 * extent) / size;
  for (const box of boxes) {
    const x0 = Math.max(0, Math.floor((box.min.x + extent) / cell));
    const x1 = Math.min(size - 1, Math.floor((box.max.x + extent) / cell));
    const z0 = Math.max(0, Math.floor((box.min.z + extent) / cell));
    const z1 = Math.min(size - 1, Math.floor((box.max.z + extent) / cell));
    for (let z = z0; z <= z1; z += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const k = z * size + x;
        if (box.max.y > data[k]) data[k] = box.max.y;
      }
    }
  }
  return {
    data,
    size,
    extent,
    heightAt(x, z) {
      const ix = Math.floor((x + extent) / cell);
      const iz = Math.floor((z + extent) / cell);
      if (ix < 0 || iz < 0 || ix >= size || iz >= size) return -0.7;
      return data[iz * size + ix];
    },
  };
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
  const surface = (src, role, override = null) => {
    const key = `${src?.name}|${role}|${override ?? ""}`;
    if (!materialCache.has(key)) materialCache.set(key, makeSurfaceMaterial(src, role, gradientMap, registry, override));
    return materialCache.get(key);
  };

  const animatedRoots = [];
  gltfScene.traverse((node) => { if (isAnimatedKonbiniNode(node.name)) animatedRoots.push(node); });
  const insideAnimated = (node) => {
    for (let p = node; p; p = p.parent) if (animatedRoots.includes(p)) return p;
    return null;
  };

  const meshes = [];
  const roofBoxes = [];
  gltfScene.traverse((node) => { if (node.isMesh) meshes.push(node); });

  for (const mesh of meshes) {
    const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const role = classifyKonbiniMaterial(src?.name);
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getSize(size).multiply(mesh.getWorldScale(new THREE.Vector3()));
    const extent = Math.max(size.x, size.y, size.z);
    const owner = insideAnimated(mesh);
    const worldBox = new THREE.Box3().setFromObject(mesh);
    const foot = (worldBox.max.x - worldBox.min.x) * (worldBox.max.z - worldBox.min.z);
    if (role !== "glass" && role !== "puddle" && !/^(Wire|WirePole|UtilPole|LampPole|TLPole|SignPost|TLArm|LampArm|CrossArm)/.test(mesh.name) && foot > 0.2 && worldBox.max.y > 0.3) roofBoxes.push(worldBox);
    const override = toneOverrideFor(mesh.name, src?.name);

    if (role === "static" && !owner) {
      const g = stripToPositionNormal(mesh.geometry).applyMatrix4(mesh.matrixWorld);
      const bucketKey = `${src?.name ?? "default"}|${override ?? ""}`;
      if (!staticBuckets.has(bucketKey)) staticBuckets.set(bucketKey, { src, override, geoms: [] });
      staticBuckets.get(bucketKey).geoms.push(g);
      if (shouldOutline(role, extent)) outlineGeoms.push(g);
      continue;
    }

    const material = surface(src, role, override);
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

  for (const { src, override, geoms } of staticBuckets.values()) {
    const merged = registry.trackGeometry(mergeGeometries(geoms, false));
    const mesh = new THREE.Mesh(merged, surface(src, "static", override));
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

  return { root, parts, materialsByName: materialCache, outlineMaterial, heightField: createHeightField(roofBoxes) };
}

export function loadKonbiniModel({ url = KONBINI_MODEL_URL, dracoPath = KONBINI_DRACO_PATH } = {}) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(dracoPath);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader.loadAsync(url).finally(() => draco.dispose());
}
