import * as THREE from "three";
import {
  createOrbitController,
  createSceneResourceRegistry,
  collectSceneResources,
  disposeScene3D,
  shouldAnimate,
  syncOrbitCamera,
} from "./rainy-store-runtime.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HEIGHT_FIELD, buildKonbiniDiorama, loadKonbiniModel } from "./rainy-konbini-loader.js";

/*
 * Rainy-night konbini diorama. The store geometry comes from the Blender
 * diorama (public/models/rainy-konbini.glb); everything that moves - rain,
 * eave drips, glass drops, puddle ripples, sign flicker, auto door and the
 * traffic signal - is rebuilt here so it stays cheap and loops forever.
 */

const COLORS = {
  night: 0x08141d,
  hemiSky: 0x7f8fae,
  hemiGround: 0x1c1f26,
  moon: 0x8eaaff,
  warm: 0xffc78a,
  rain: 0xa9c4ff,
};

// Blender (x, y, z) -> three (x, z, -y)
const ROOF = { minX: -2.75, maxX: 2.75, minZ: -3.7, maxZ: 0.7, top: 2.9 };
const AWNING = { minX: -2.8, maxX: 2.8, minZ: 0.65, maxZ: 1.65, top: 2.33 };
export const SIGNAL_CYCLE = [
  { color: "green", until: 10 },
  { color: "yellow", until: 13 },
  { color: "red", until: 24 },
];
const DOOR_CYCLE = 14;
const DOOR_SLIDE = 0.82;

export function signalColorAt(seconds) {
  const t = ((seconds % 24) + 24) % 24;
  return SIGNAL_CYCLE.find((step) => t < step.until).color;
}

export function doorOpenAmount(seconds) {
  const t = ((seconds % DOOR_CYCLE) + DOOR_CYCLE) % DOOR_CYCLE;
  const ramp = (x) => Math.min(1, Math.max(0, x));
  const opening = ramp((t - 9.5) / 0.8);
  const closing = ramp((t - 12.4) / 0.9);
  const v = opening - closing;
  return v * v * (3 - 2 * v);
}

export function signFlicker(seconds) {
  const t = seconds % 9;
  if (t > 6.0 && t < 6.08) return 0.15;
  if (t > 6.16 && t < 6.22) return 0.4;
  if (t > 6.3 && t < 6.36) return 0.2;
  return 1;
}

function createRain(registry, count) {
  const offsets = new Float32Array(count * 2 * 3);
  const tails = new Float32Array(count * 2);
  const seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const x = (Math.random() * 2 - 1) * 6.4;
    const z = (Math.random() * 2 - 1) * 6.4;
    const s = Math.random();
    for (let k = 0; k < 2; k += 1) {
      const o = (i * 2 + k) * 3;
      offsets[o] = x; offsets[o + 1] = 0; offsets[o + 2] = z;
      tails[i * 2 + k] = k;
      seeds[i * 2 + k] = s;
    }
  }
  const geometry = registry.trackGeometry(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(offsets, 3));
  geometry.setAttribute("aTail", new THREE.BufferAttribute(tails, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const material = registry.trackMaterial(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(COLORS.rain) },
      uHeight: { value: null },
      uExtent: { value: HEIGHT_FIELD.extent },
    },
    vertexShader: `uniform float uTime; attribute float aTail; attribute float aSeed; varying float vA;
      uniform sampler2D uHeight; uniform float uExtent;
      float floorAt(vec2 p){
        vec2 uv = (p + uExtent) / (2.0 * uExtent);
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -0.7;
        if (abs(p.x) > 6.2 || abs(p.y) > 6.2) return -0.7;
        return max(0.04, texture2D(uHeight, uv).r + 0.02);
      }
      void main(){
        float top = 9.0; float ground = floorAt(position.xz);
        float span = top - ground;
        float speed = 7.5 + aSeed * 3.5;
        float y = ground + mod(top - uTime * speed - aSeed * 97.0, span);
        float len = 0.28 + aSeed * 0.22;
        vec3 p = vec3(position.x - 0.03 * aTail, y + aTail * len, position.z);
        p.y = max(p.y, ground);
        vA = (0.35 + 0.4 * aSeed) * (1.0 - aTail * 0.7);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`,
  }));
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.renderOrder = 3;
  return lines;
}

const PUDDLE_SHADER = {
  name: "KonbiniPuddleReflector",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x18233f) },
  },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec3 uDeep; uniform vec3 color;
    varying vec4 vUv; varying vec3 vW;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      vec2 p = vW.xz;
      vec2 offset = vec2(0.0);
      float ring = 0.0;
      for (int i = 0; i < 3; i++){
        vec2 cell = floor(p * 1.6 + float(i) * 0.37);
        float h = hash(cell + float(i) * 7.1);
        float t = fract(uTime * (0.55 + 0.3 * h) + h);
        vec2 c = (cell + 0.25 + 0.5 * vec2(h, hash(cell.yx + 3.0)) - float(i) * 0.37) / 1.6;
        vec2 dv = p - c;
        float d = length(dv);
        float r = t * 0.22;
        float w = smoothstep(0.03, 0.0, abs(d - r)) * (1.0 - t) * step(d, 0.24);
        ring += w;
        offset += (d > 1e-4 ? dv / d : vec2(0.0)) * w * 0.012;
      }
      vec4 uv = vUv;
      uv.xy += offset * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      vec3 col = mix(uDeep, refl * color, 0.78);
      col += vec3(0.55, 0.65, 0.85) * clamp(ring, 0.0, 1.0) * 0.18;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
};

/**
 * One planar reflector shared by every puddle (a single extra low-res render
 * per frame; several reflectors would recursively render each other). Puddle
 * meshes are merged into one geometry in the reflector's local XY plane; the
 * raised sidewalk puddle keeps its small height offset.
 */
function createPuddleReflector(puddles, renderer, mount) {
  if (!puddles.length) return null;
  const tops = puddles.map((mesh) => {
    mesh.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(mesh).max.y;
  });
  const level = Math.min(...tops) + 0.004;
  const toPlane = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const geoms = puddles.map((mesh, index) => {
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const key of Object.keys(g.attributes)) if (key !== "position") g.deleteAttribute(key);
    g.applyMatrix4(mesh.matrixWorld);
    const pos = g.attributes.position;
    const lift = tops[index] + 0.004 - level;
    for (let i = 0; i < pos.count; i += 1) pos.setY(i, lift);
    g.applyMatrix4(toPlane);
    return g;
  });
  const geometry = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  const scale = 0.5 * renderer.getPixelRatio();
  const reflector = new Reflector(geometry, {
    shader: PUDDLE_SHADER,
    color: 0xb8c4dc,
    clipBias: 0.003,
    multisample: 0,
    textureWidth: Math.max(256, Math.round((mount.clientWidth || 800) * scale)),
    textureHeight: Math.max(256, Math.round((mount.clientHeight || 450) * scale)),
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = level;
  reflector.renderOrder = 1;
  reflector.name = "PuddleReflector";
  puddles.forEach((mesh) => { mesh.visible = false; });
  return reflector;
}

function createDrops(registry, count, { color, radius, stretch }) {
  const geometry = registry.trackGeometry(new THREE.SphereGeometry(radius, 6, 4));
  geometry.scale(1, stretch, 1);
  const material = registry.trackMaterial(new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.75, depthWrite: false,
  }));
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return mesh;
}

export function createEdgeDripSpots() {
  const spots = [];
  const along = (n, fn) => { for (let i = 0; i < n; i += 1) spots.push(fn((i + 0.5) / n)); };
  along(14, (t) => ({ x: AWNING.minX + 0.2 + t * (AWNING.maxX - AWNING.minX - 0.4), z: AWNING.maxZ + 0.02, top: AWNING.top - 0.27 }));
  along(3, (t) => ({ x: AWNING.minX - 0.02, z: AWNING.minZ + t * (AWNING.maxZ - AWNING.minZ), top: AWNING.top - 0.27 }));
  along(3, (t) => ({ x: AWNING.maxX + 0.02, z: AWNING.minZ + t * (AWNING.maxZ - AWNING.minZ), top: AWNING.top - 0.27 }));
  along(7, (t) => ({ x: ROOF.minX - 0.04, z: ROOF.minZ + 0.2 + t * (ROOF.maxZ - ROOF.minZ - 0.4), top: 2.7 }));
  along(7, (t) => ({ x: ROOF.maxX + 0.04, z: ROOF.minZ + 0.2 + t * (ROOF.maxZ - ROOF.minZ - 0.4), top: 2.7 }));
  return spots;
}

function createEaveDrips(registry) {
  const spots = createEdgeDripSpots();
  const mesh = createDrops(registry, spots.length, { color: 0xcfe0ff, radius: 0.03, stretch: 2.2 });
  const drips = spots.map((spot) => ({
    ...spot,
    bottom: 0.08,
    phase: Math.random(),
    period: 1.1 + Math.random() * 1.3,
  }));
  return { mesh, drips };
}

function createGlassDrops(registry) {
  const front = Array.from({ length: 26 }, () => ({
    x: -2.5 + Math.random() * 5.0, z: 0.7, side: false,
    phase: Math.random(), period: 5 + Math.random() * 6,
  }));
  const left = Array.from({ length: 16 }, () => ({
    x: -2.68, z: -3.4 + Math.random() * 3.8, side: true,
    phase: Math.random(), period: 5 + Math.random() * 6,
  }));
  const drops = [...front, ...left];
  const mesh = createDrops(registry, drops.length, { color: 0xd8e6ff, radius: 0.022, stretch: 1.5 });
  mesh.material.opacity = 0.55;
  return { mesh, drops };
}

function stepDrips(state, time, dummy) {
  state.drips.forEach((drip, index) => {
    const t = ((time / drip.period + drip.phase) % 1);
    const hang = 0.35;
    let y = drip.top;
    let s = 1;
    if (t < hang) {
      s = 0.4 + (t / hang) * 0.6;
    } else {
      const f = (t - hang) / (1 - hang);
      y = drip.top - (drip.top - drip.bottom) * f * f;
    }
    dummy.position.set(drip.x, y, drip.z);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    state.mesh.setMatrixAt(index, dummy.matrix);
  });
  state.mesh.instanceMatrix.needsUpdate = true;
}

function stepGlassDrops(state, time, dummy) {
  state.drops.forEach((drop, index) => {
    const t = ((time / drop.period + drop.phase) % 1);
    const slide = t < 0.5 ? t * 0.15 : 0.075 + (t - 0.5) * 3.4;
    const y = Math.max(0.25, 2.0 - slide);
    dummy.position.set(drop.x, y, drop.z);
    dummy.scale.setScalar(t > 0.97 ? 0.001 : 1);
    dummy.updateMatrix();
    state.mesh.setMatrixAt(index, dummy.matrix);
  });
  state.mesh.instanceMatrix.needsUpdate = true;
}

export function createRainyStoreScene({
  mount,
  reducedMotion = false,
  screenshotMode = false,
  onFailure,
  onReady,
}) {
  if (!mount) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: screenshotMode,
      powerPreference: "low-power",
    });
  } catch (error) {
    console.warn("RainyStoreScene: WebGL unavailable.", error);
    onFailure?.(error);
    return null;
  }

  const registry = createSceneResourceRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.night);
  scene.fog = new THREE.Fog(COLORS.night, 24, 46);
  const lowPower = window.matchMedia?.("(max-width: 1023px)")?.matches
    || (navigator.hardwareConcurrency || 8) <= 4;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.className = "tt-rainy-canvas";
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "Interactive rainy convenience store miniature");
  mount.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  // Frame the whole plinth/store; viewOffset below lifts it into the clear band above cards.
  const target = new THREE.Vector3(0, 1.05, 0.2);
  const orbit = { yaw: 0.56, pitch: 0.42, distance: 22 };
  const defaultOrbit = { ...orbit };
  /** Bottom frosted card dock coverage; keep in sync with .tt-rainy-card-pane max-height. */
  const CARD_DOCK_FRACTION = 0.28;
  syncOrbitCamera(camera, target, orbit);

  scene.add(new THREE.HemisphereLight(COLORS.hemiSky, COLORS.hemiGround, 1.05));
  const moon = new THREE.DirectionalLight(COLORS.moon, 1.0);
  moon.position.set(-8, 14, 9);
  scene.add(moon);
  const interior = [
    [0, 1.7, -1.2, 9], [-1.6, 2.2, -1.4, 4], [1.6, 2.2, -1.4, 4], [0, 1.2, 1.4, 4],
  ].map(([x, y, z, intensity]) => {
    const light = new THREE.PointLight(COLORS.warm, intensity, 7, 1.2);
    light.position.set(x, y, z);
    light.userData.base = intensity;
    scene.add(light);
    return light;
  });
  const lamp = new THREE.PointLight(0xffb979, 7, 6, 1.3);
  lamp.position.set(-4, 3.2, 3);
  scene.add(lamp);
  const vending = new THREE.PointLight(0xbfe1ff, 3, 4, 1.4);
  vending.position.set(3.5, 1.3, 1.1);
  scene.add(vending);

  const rain = createRain(registry, lowPower ? 900 : 1800);
  const drips = createEaveDrips(registry);
  const glassDrops = createGlassDrops(registry);
  let reflectors = [];
  let outlineMaterial = null;
  let heightTexture = null;
  scene.add(rain, drips.mesh, glassDrops.mesh);

  let parts = null;
  let disposed = false;
  const dummy = new THREE.Object3D();

  const applyTime = (time) => {
    rain.material.uniforms.uTime.value = time;
    reflectors.forEach((r) => { r.material.uniforms.uTime.value = time; });
    stepDrips(drips, time, dummy);
    stepGlassDrops(glassDrops, time, dummy);
    if (!parts) return;
    const flicker = signFlicker(time);
    parts.signs.forEach((mesh) => {
      mesh.material.emissiveIntensity = mesh.material.userData.baseEmissive * flicker;
    });
    const open = doorOpenAmount(time);
    if (parts.doors.DoorL) parts.doors.DoorL.position.x = -open * DOOR_SLIDE;
    if (parts.doors.DoorR) parts.doors.DoorR.position.x = open * DOOR_SLIDE;
    const active = signalColorAt(time);
    Object.entries(parts.signals).forEach(([color, meshes]) => {
      meshes.forEach((mesh) => { mesh.material.emissiveIntensity = color === active ? 2.6 : 0; });
    });
    interior[0].intensity = interior[0].userData.base * (0.97 + Math.sin(time * 1.3) * 0.03);
  };

  const render = () => renderer.render(scene, camera);

  loadKonbiniModel()
    .then((gltf) => {
      if (disposed) {
        collectSceneResources(gltf.scene).geometries.forEach((g) => g.dispose());
        return;
      }
      const built = buildKonbiniDiorama(gltf.scene, registry);
      parts = built.parts;
      outlineMaterial = built.outlineMaterial;
      const hf = built.heightField;
      heightTexture = registry.trackTexture(new THREE.DataTexture(hf.data, hf.size, hf.size, THREE.RedFormat, THREE.FloatType));
      heightTexture.needsUpdate = true;
      rain.material.uniforms.uHeight.value = heightTexture;
      drips.drips.forEach((drip) => { drip.bottom = Math.max(0.06, hf.heightAt(drip.x, drip.z) + 0.02); });
      const reflector = createPuddleReflector(parts.puddles, renderer, mount);
      if (reflector) {
        reflectors = [reflector];
        scene.add(reflector);
      }
      resize();
      Object.values(parts.signals).flat().forEach((mesh) => {
        mesh.material.emissive = mesh.material.color.clone();
        mesh.material.color.multiplyScalar(0.03);
      });
      scene.add(built.root);
      applyTime(screenshotMode ? 4.2 : 0);
      render();
      onReady?.(parts);
    })
    .catch((error) => {
      console.warn("RainyStoreScene: unable to load konbini model.", error);
      if (!disposed) onFailure?.(error);
    });

  const resize = () => {
    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 500 ? 42 : 32;
    // Use the lower band of a taller virtual film so the diorama sits in the
    // clear upper viewport instead of behind the frosted card dock.
    const dock = Math.min(0.4, Math.max(0, CARD_DOCK_FRACTION));
    if (dock > 0.05 && height > 200) {
      const shift = Math.round(height * dock);
      const fullH = height + shift;
      camera.setViewOffset(width, fullH, 0, shift, width, height);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    outlineMaterial?.uniforms.uResolution.value.set(width, height);
    render();
  };
  resize();
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(mount);

  let inView = true;
  const intersectionObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => { inView = entries[0]?.isIntersecting ?? true; }, { threshold: 0 })
    : null;
  intersectionObserver?.observe(mount);

  let hidden = document.visibilityState === "hidden";
  const onVisibility = () => { hidden = document.visibilityState === "hidden"; };
  document.addEventListener("visibilitychange", onVisibility);

  const reduceMotion = reducedMotion
    || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    || false;

  const resetView = () => {
    Object.assign(orbit, defaultOrbit);
    syncOrbitCamera(camera, target, orbit);
    render();
  };
  const removePointerOrbit = createOrbitController(mount, orbit, resetView, () => {
    syncOrbitCamera(camera, target, orbit);
    render();
  });

  const timer = new THREE.Timer();
  let sceneTime = 0;
  let frameId = 0;
  const animate = (time) => {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.05);
    if (!shouldAnimate({ hidden, inView, reducedMotion: reduceMotion, screenshotMode })) return;
    sceneTime += dt;
    applyTime(sceneTime);
    syncOrbitCamera(camera, target, orbit);
    render();
  };
  frameId = requestAnimationFrame(animate);

  return {
    resetView,
    /** Test/screenshot hook: jump the loop to a given second and redraw. */
    seek(seconds) {
      sceneTime = seconds;
      applyTime(seconds);
      render();
    },
    /** Screenshot hook: set the orbit (and optionally the loop time) and redraw. */
    setView(yaw, pitch, distance, seconds) {
      Object.assign(orbit, { yaw, pitch, distance });
      syncOrbitCamera(camera, target, orbit);
      if (seconds != null) {
        sceneTime = seconds;
        applyTime(seconds);
      }
      render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      removePointerOrbit();
      reflectors.forEach((r) => r.dispose());
      const sceneResources = collectSceneResources(scene);
      scene.clear();
      disposeScene3D({
        geometries: [...registry.geometries, ...sceneResources.geometries],
        materials: [...registry.materials, ...sceneResources.materials],
        textures: [...registry.textures, ...sceneResources.textures],
        renderer,
      });
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    },
  };
}
