const MIN_PITCH = 0.12;
const MAX_PITCH = 0.78;
const MIN_DISTANCE = 12;
const MAX_DISTANCE = 26;

export function clampOrbit({ yaw, pitch, distance }) {
  return {
    yaw,
    pitch: Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch)),
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance)),
  };
}

function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function createRainGeometry({ count, seed = 1 }) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const random = seededRandom(seed);
  const positions = new Array(safeCount * 3);
  const speeds = new Array(safeCount);
  const lengths = new Array(safeCount);

  for (let index = 0; index < safeCount; index += 1) {
    positions[index * 3] = random() * 18 - 9;
    positions[index * 3 + 1] = random() * 11;
    positions[index * 3 + 2] = random() * 18 - 8;
    speeds[index] = 3.2 + random() * 2.8;
    lengths[index] = 0.3 + random() * 0.45;
  }

  return { positions, speeds, lengths };
}

export function shouldAnimate({
  hidden = false,
  inView = true,
  reducedMotion = false,
  screenshotMode = false,
}) {
  return !hidden && inView && !reducedMotion && !screenshotMode;
}

export function disposeScene3D({ geometries = [], materials = [], textures = [], renderer }) {
  const disposed = new Set();
  const disposeOnce = (resource) => {
    if (!resource || disposed.has(resource) || typeof resource.dispose !== "function") return;
    disposed.add(resource);
    resource.dispose();
  };

  geometries.forEach(disposeOnce);
  materials.forEach(disposeOnce);
  textures.forEach(disposeOnce);
  renderer?.renderLists?.dispose?.();
  renderer?.dispose?.();
  renderer?.forceContextLoss?.();
}

export function syncOrbitCamera(camera, target, orbit) {
  const safe = clampOrbit(orbit);
  orbit.pitch = safe.pitch;
  orbit.distance = safe.distance;
  const horizontal = Math.cos(orbit.pitch) * orbit.distance;
  camera.position.set(
    Math.sin(orbit.yaw) * horizontal,
    Math.sin(orbit.pitch) * orbit.distance + 2.2,
    Math.cos(orbit.yaw) * horizontal,
  );
  camera.lookAt(target);
}

export function createOrbitController(mount, orbit, reset, render) {
  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    mount.setPointerCapture?.(pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    orbit.yaw -= dx * 0.006;
    orbit.pitch += dy * 0.0042;
    Object.assign(orbit, clampOrbit(orbit));
    render?.();
  };
  const finishPointer = (event) => {
    if (pointerId != null && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
  };
  const onWheel = (event) => {
    if (!event.shiftKey) return;
    event.preventDefault();
    orbit.distance += event.deltaY * 0.014;
    Object.assign(orbit, clampOrbit(orbit));
    render?.();
  };
  const onKeyDown = (event) => {
    if (event.key !== "0" && event.key !== "Home") return;
    event.preventDefault();
    reset();
  };

  mount.addEventListener("pointerdown", onPointerDown);
  mount.addEventListener("pointermove", onPointerMove);
  mount.addEventListener("pointerup", finishPointer);
  mount.addEventListener("pointercancel", finishPointer);
  mount.addEventListener("wheel", onWheel, { passive: false });
  mount.addEventListener("keydown", onKeyDown);

  return () => {
    mount.removeEventListener("pointerdown", onPointerDown);
    mount.removeEventListener("pointermove", onPointerMove);
    mount.removeEventListener("pointerup", finishPointer);
    mount.removeEventListener("pointercancel", finishPointer);
    mount.removeEventListener("wheel", onWheel);
    mount.removeEventListener("keydown", onKeyDown);
  };
}
