import * as THREE from "three";
import {
  createOrbitController,
  createRainGeometry,
  disposeScene3D,
  shouldAnimate,
  syncOrbitCamera,
} from "./rainy-store-runtime.js";
const COLORS = {
  night: 0x07151f,
  base: 0x102b38,
  baseEdge: 0x071b26,
  asphalt: 0x132936,
  sidewalk: 0x536c72,
  curb: 0xa4b1aa,
  storeWall: 0xd9d8c2,
  storeWallShadow: 0x6f8982,
  trim: 0x263f48,
  glass: 0x8bcdca,
  warm: 0xffd99a,
  warmWall: 0xf7dfaa,
  coral: 0xe88268,
  cyan: 0x77ead6,
  blue: 0x73b8dd,
  amber: 0xf0c177,
  white: 0xf4f4dc,
  red: 0xe56c68,
  green: 0x63d3b7,
  dark: 0x1d2c39,
  productA: 0xe17462,
  productB: 0x66a58b,
  productC: 0xe7bd69,
  productD: 0x6b9fc9,
};

function makeMaterial(color, options = {}) {
  return new THREE.MeshToonMaterial({
    color,
    ...options,
  });
}

function addBox(parent, w, h, d, material, x, y, z, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh);
  return mesh;
}

function addGlowLine(parent, points, color, opacity = 0.85) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  parent.add(line);
  return line;
}

function makeSignTexture(title, subtitle, background, foreground) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 200;
  const context = canvas.getContext("2d");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(134, 239, 218, 0.5)";
  context.lineWidth = 3;
  context.strokeRect(17, 17, canvas.width - 34, canvas.height - 34);
  context.fillStyle = foreground;
  context.font = "900 92px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(title, 512, 86);
  context.font = "600 19px monospace";
  context.letterSpacing = "7px";
  context.fillText(subtitle, 512, 160);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addSignal(parent) {
  const group = new THREE.Group();
  group.position.set(-8.2, 0, -1.1);
  const pole = makeMaterial(0x1b3944);
  addBox(group, 0.08, 3.4, 0.08, pole, 0, 1.75, 0);
  addBox(group, 0.62, 0.28, 0.25, pole, 0.25, 3.25, 0);
  const colors = [COLORS.red, COLORS.amber, COLORS.green];
  const bulbs = colors.map((color, index) => {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 10, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: index === 2 ? 1 : 0.25 }),
    );
    bulb.position.set(0.08 + index * 0.17, 3.25, 0.14);
    group.add(bulb);
    return bulb;
  });
  parent.add(group);
  return bulbs;
}

function addStreetLamp(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const metal = makeMaterial(0x657a7a);
  addBox(group, 0.09, 4.1, 0.09, metal, 0, 2.05, 0);
  addBox(group, 0.86, 0.07, 0.07, metal, 0.38, 4.05, 0);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 9),
    new THREE.MeshBasicMaterial({ color: 0xffe6ad }),
  );
  lamp.position.set(0.8, 3.93, 0);
  group.add(lamp);
  const light = new THREE.PointLight(0xffd28c, 2.2, 5, 2);
  light.position.copy(lamp.position);
  group.add(light);
  parent.add(group);
  return { group, light };
}

function addBollard(parent, x, z, color) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  addBox(group, 0.11, 0.72, 0.11, makeMaterial(0x344d54), 0, 0.36, 0);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 9, 7),
    new THREE.MeshBasicMaterial({ color }),
  );
  cap.position.y = 0.74;
  group.add(cap);
  parent.add(group);
}

function addBicycle(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0.35, z);
  group.rotation.y = -0.34;
  const metal = new THREE.MeshBasicMaterial({ color: 0xb7d6d0 });
  const wheelGeometry = new THREE.TorusGeometry(0.32, 0.023, 6, 24);
  for (const wheelX of [-0.48, 0.5]) {
    const wheel = new THREE.Mesh(wheelGeometry, metal);
    wheel.position.set(wheelX, 0, 0);
    wheel.rotation.y = Math.PI / 2;
    group.add(wheel);
  }
  const barPoints = [
    new THREE.Vector3(-0.48, 0, 0),
    new THREE.Vector3(-0.2, 0.48, 0),
    new THREE.Vector3(0.24, 0.45, 0),
    new THREE.Vector3(0.5, 0, 0),
    new THREE.Vector3(-0.48, 0, 0),
    new THREE.Vector3(0.05, 0.12, 0),
    new THREE.Vector3(-0.2, 0.48, 0),
    new THREE.Vector3(0.42, 0.55, 0),
  ];
  addGlowLine(group, barPoints, 0xb4d5cf, 0.9);
  parent.add(group);
}

function addVendingMachine(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = -0.18;
  addBox(group, 0.9, 2.05, 0.65, makeMaterial(0xd5ddd0), 0, 1.02, 0);
  addBox(group, 0.78, 0.22, 0.05, makeMaterial(0x284f5a), 0, 1.82, 0.34);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.67, 1.18),
    new THREE.MeshBasicMaterial({ color: 0x76d9cd, transparent: true, opacity: 0.8 }),
  );
  screen.position.set(0, 1.22, 0.34);
  group.add(screen);
  const colors = [COLORS.productA, COLORS.productB, COLORS.productC];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      addBox(
        group,
        0.1,
        0.16,
        0.04,
        makeMaterial(colors[(row + col) % colors.length]),
        -0.25 + col * 0.165,
        0.86 + row * 0.27,
        0.37,
        { castShadow: false },
      );
    }
  }
  addBox(group, 0.52, 0.16, 0.04, makeMaterial(0x1b3640), 0, 0.47, 0.36);
  parent.add(group);
}

function addStoreInterior(parent) {
  const interior = new THREE.Group();
  interior.position.set(0, 0.18, -1.8);
  parent.add(interior);

  const shelfPositions = [-2.7, -1.05, 0.62, 2.3];
  const shelfFrame = makeMaterial(0xe7e0c3);
  const shelfLine = new THREE.MeshBasicMaterial({
    color: 0xc5fff0,
    transparent: true,
    opacity: 0.72,
  });
  const productMaterials = [
    makeMaterial(COLORS.productA),
    makeMaterial(COLORS.productB),
    makeMaterial(COLORS.productC),
    makeMaterial(COLORS.productD),
  ];

  for (let shelfIndex = 0; shelfIndex < shelfPositions.length; shelfIndex += 1) {
    const x = shelfPositions[shelfIndex];
    addBox(interior, 1.46, 2.22, 0.5, shelfFrame, x, 1.12, -0.82);
    for (let row = 0; row < 5; row += 1) {
      const y = 0.36 + row * 0.4;
      addBox(interior, 1.42, 0.035, 0.06, shelfLine, x, y, -0.54, { castShadow: false });
      for (let col = 0; col < 7; col += 1) {
        if ((row + col + shelfIndex) % 8 === 0) continue;
        addBox(
          interior,
          0.11,
          0.2 + ((row + col) % 3) * 0.04,
          0.13,
          productMaterials[(row + col + shelfIndex) % productMaterials.length],
          x - 0.57 + col * 0.19,
          y + 0.11,
          -0.54,
          { castShadow: false },
        );
      }
    }
    addBox(interior, 0.03, 2.02, 0.03, shelfLine, x + 0.72, 1.2, -0.54, {
      castShadow: false,
    });
  }

  // Back-wall refrigeration and a bright beverage display.
  addBox(interior, 3.2, 1.85, 0.3, makeMaterial(0xc8e2d7), 1.1, 0.95, -1.49);
  for (let col = 0; col < 5; col += 1) {
    const door = addBox(
      interior,
      0.54,
      1.95,
      0.035,
      new THREE.MeshBasicMaterial({ color: 0xb4f2e6, transparent: true, opacity: 0.57 }),
      0.02 + col * 0.58,
      1.12,
      -1.31,
      { castShadow: false },
    );
    door.renderOrder = 2;
    for (let row = 0; row < 5; row += 1) {
      addBox(
        interior,
        0.4,
        0.045,
        0.04,
        productMaterials[(row + col) % productMaterials.length],
        0.02 + col * 0.58,
        0.5 + row * 0.33,
        -1.26,
        { castShadow: false },
      );
    }
  }

  // Checkout counter, register, coffee and oden stations.
  addBox(interior, 2.1, 0.78, 0.58, makeMaterial(0x6d7c70), -2.42, 0.39, 0.91);
  addBox(interior, 2.2, 0.06, 0.68, makeMaterial(COLORS.white), -2.42, 0.82, 0.91);
  addBox(interior, 0.43, 0.19, 0.35, makeMaterial(0x263941), -2.68, 1.0, 0.78);
  const registerScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.16),
    new THREE.MeshBasicMaterial({ color: COLORS.cyan }),
  );
  registerScreen.position.set(-2.68, 1.03, 0.96);
  interior.add(registerScreen);
  addBox(interior, 0.42, 0.55, 0.36, makeMaterial(0xb68d68), -3.0, 1.08, 0.72);
  addBox(interior, 0.5, 0.1, 0.4, makeMaterial(0xd2aa78), -3.0, 1.38, 0.72);
  addBox(interior, 0.74, 0.08, 0.42, makeMaterial(0xe2c58e), -1.3, 0.88, 0.94);
  addBox(interior, 0.62, 0.2, 0.34, makeMaterial(0xa45e54), -1.3, 0.98, 0.94);

  // Magazine rack, hot-food display and floor guides.
  for (let index = 0; index < 4; index += 1) {
    addBox(
      interior,
      0.38,
      0.48,
      0.08,
      productMaterials[index % productMaterials.length],
      2.55,
      0.38 + index * 0.08,
      0.5 - index * 0.14,
      { rotation: [-0.18, 0, 0], castShadow: false },
    );
  }
  const guideMaterial = new THREE.MeshBasicMaterial({
    color: 0x8de9d5,
    transparent: true,
    opacity: 0.18,
  });
  for (const x of [-2.9, -1.4, 0.2, 1.8, 3.1]) {
    addBox(interior, 0.025, 0.01, 2.5, guideMaterial, x, 0.04, 0.05, {
      castShadow: false,
    });
  }
  addBox(interior, 0.62, 1.82, 0.46, makeMaterial(0x6b786b), 3.55, 0.91, -0.65);
  addBox(interior, 0.4, 0.6, 0.08, makeMaterial(0x314c51), 3.55, 1.0, -0.4);

  // Ceiling strips.
  for (let index = 0; index < 5; index += 1) {
    addBox(
      interior,
      1.2,
      0.035,
      0.09,
      new THREE.MeshBasicMaterial({ color: 0xffefbe }),
      -2.65 + index * 1.3,
      2.16,
      -0.34,
      { castShadow: false },
    );
  }
  return interior;
}

function addStore(parent, resources) {
  const store = new THREE.Group();
  store.position.set(0, 0.25, -1.15);
  store.rotation.y = -0.035;
  parent.add(store);

  // A cutaway roof preserves the miniature architecture while keeping the lit
  // shelves, counter and refrigeration visible from the primary camera angle.
  addBox(store, 8.4, 2.0, 3.8, makeMaterial(COLORS.storeWall), 0, 1.0, 0);
  addBox(store, 8.4, 2.1, 3.8, makeMaterial(COLORS.warmWall), 0, 3.05, -0.22);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.55, 0.16, 2.25), makeMaterial(COLORS.trim));
  roof.position.set(0, 4.14, -0.82);
  roof.rotation.x = -0.035;
  roof.castShadow = true;
  store.add(roof);
  addBox(store, 8.62, 0.2, 0.38, makeMaterial(COLORS.storeWallShadow), 0, 4.14, -2.08);
  addBox(store, 8.52, 0.16, 3.9, makeMaterial(COLORS.trim), 0, 0.04, 0);

  // Open the front with a broad glazed facade.
  const facade = new THREE.Group();
  facade.position.set(0, 0, 1.93);
  store.add(facade);
  addBox(facade, 7.84, 2.84, 0.06, new THREE.MeshPhysicalMaterial({
    color: COLORS.glass,
    transparent: true,
    opacity: 0.1,
    roughness: 0.06,
    metalness: 0.08,
    transmission: 0.58,
    side: THREE.DoubleSide,
  }), 0, 1.82, 0, { castShadow: false });
  addBox(facade, 7.95, 0.13, 0.12, makeMaterial(COLORS.trim), 0, 3.24, 0.07);
  addBox(facade, 7.95, 0.13, 0.12, makeMaterial(COLORS.trim), 0, 0.39, 0.07);
  for (const x of [-3.93, -2.3, -0.65, 0.4, 2.64, 3.93]) {
    addBox(facade, 0.075, 2.88, 0.12, makeMaterial(COLORS.trim), x, 1.82, 0.07);
  }

  const door = new THREE.Group();
  door.position.set(2.0, 0.42, 2.08);
  store.add(door);
  const doorPanelMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x72bac1,
    transparent: true,
    opacity: 0.35,
    roughness: 0.16,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });
  addBox(door, 0.5, 2.6, 0.055, doorPanelMaterial, -0.39, 1.3, 0);
  addBox(door, 0.5, 2.6, 0.055, doorPanelMaterial, 0.39, 1.3, 0);
  addBox(door, 0.025, 2.5, 0.025, makeMaterial(COLORS.cyan), 0, 1.3, 0.04, {
    castShadow: false,
  });
  addBox(store, 1.6, 1.45, 0.12, makeMaterial(COLORS.coral), 2.0, 3.46, 1.91);
  const signTexture = makeSignTexture(
    "TOKEN MART",
    "OPEN ALL NIGHT  ·  LOCAL TOKENS INSIDE",
    "#18343a",
    "#e3f6dd",
  );
  resources.textures.push(signTexture);
  const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture });
  resources.materials.push(signMaterial);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.91), signMaterial);
  sign.position.set(2.0, 3.46, 1.98);
  store.add(sign);

  // Main front sign.
  addBox(store, 7.95, 1.18, 0.14, makeMaterial(COLORS.trim), 0, 3.94, 1.95);
  const mainTexture = makeSignTexture(
    "TOKEN MART",
    "AUTONOMOUS NEIGHBORHOOD STORE",
    "#17343a",
    "#f1f4d4",
  );
  resources.textures.push(mainTexture);
  const mainSignMaterial = new THREE.MeshBasicMaterial({ map: mainTexture });
  resources.materials.push(mainSignMaterial);
  const mainSign = new THREE.Mesh(new THREE.PlaneGeometry(7.7, 1.04), mainSignMaterial);
  mainSign.position.set(0, 3.94, 2.035);
  store.add(mainSign);
  addBox(store, 7.95, 0.04, 0.05, makeMaterial(COLORS.cyan), 0, 4.51, 2.05, {
    castShadow: false,
  });
  addBox(store, 7.95, 0.04, 0.05, makeMaterial(COLORS.cyan), 0, 3.37, 2.05, {
    castShadow: false,
  });

  // Canopy and the rain runoff edge.
  addBox(store, 8.25, 0.2, 1.15, makeMaterial(COLORS.trim), 0, 3.1, 2.35, {
    rotation: [-0.12, 0, 0],
  });
  addBox(store, 8.1, 0.06, 1.1, makeMaterial(COLORS.cyan), 0, 2.98, 2.38, {
    castShadow: false,
  });
  addBox(store, 8.25, 0.06, 0.1, makeBasicCyanMaterial(), 0, 2.92, 2.92, {
    castShadow: false,
  });

  // Side utility and roof.
  addBox(store, 0.5, 1.3, 0.8, makeMaterial(0x69817e), -4.27, 1.2, 0.34);
  addBox(store, 1.15, 0.42, 0.8, makeMaterial(COLORS.storeWallShadow), -2.72, 4.38, -0.15);
  addBox(store, 0.74, 0.18, 0.7, makeMaterial(COLORS.trim), -2.72, 4.67, -0.15);
  addBox(store, 0.07, 1.55, 0.07, makeMaterial(COLORS.trim), 3.07, 4.74, -0.15);
  const antenna = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshBasicMaterial({ color: COLORS.cyan }),
  );
  antenna.position.set(3.07, 5.47, -0.15);
  store.add(antenna);

  // Warm interior illumination.
  const interiorLight = new THREE.PointLight(0xffd28f, 15, 8, 2);
  interiorLight.position.set(-0.5, 3.0, 1.0);
  store.add(interiorLight);
  const displayLight = new THREE.PointLight(0x9df4de, 7, 5, 2);
  displayLight.position.set(2.9, 2.5, 0.65);
  store.add(displayLight);
  const frontFill = new THREE.PointLight(0xffd9a5, 8, 6, 2);
  frontFill.position.set(-1.6, 2.15, 2.85);
  store.add(frontFill);
  const frontRect = new THREE.RectAreaLight(0xffd39a, 4, 3.8, 1.5);
  frontRect.position.set(-0.4, 2.55, 3.0);
  frontRect.lookAt(0, 1.2, -0.4);
  store.add(frontRect);

  addStoreInterior(store);
  return {
    store,
    door,
    mainSign,
    mainSignMaterial,
    sign,
    signMaterial,
    interiorLight,
    displayLight,
    antenna,
  };
}

function makeBasicCyanMaterial() {
  return new THREE.MeshBasicMaterial({ color: COLORS.cyan });
}

function addStreetWorld(parent, resources) {
  const night = new THREE.Group();
  parent.add(night);

  // Entire scene rests on one square plinth.
  addBox(night, 19.4, 0.25, 19.4, makeMaterial(COLORS.base), 0, -0.05, 0, {
    receiveShadow: true,
    castShadow: false,
  });
  addBox(night, 19.9, 0.16, 19.9, makeMaterial(COLORS.baseEdge), 0, -0.23, 0, {
    receiveShadow: true,
    castShadow: false,
  });
  addBox(night, 19.55, 0.03, 19.55, makeBasicCyanMaterial(), 0, 0.09, 0, {
    castShadow: false,
    receiveShadow: false,
  });

  // Asphalt corner and raised sidewalk.
  addBox(night, 18.2, 0.08, 13.7, makeMaterial(COLORS.asphalt), 0, 0.13, 2.15, {
    receiveShadow: true,
    castShadow: false,
  });
  addBox(night, 17.9, 0.3, 4.15, makeMaterial(COLORS.sidewalk), 0, 0.29, -2.32, {
    receiveShadow: true,
    castShadow: false,
  });
  addBox(night, 17.9, 0.16, 0.18, makeMaterial(COLORS.curb), 0, 0.44, -0.27, {
    receiveShadow: true,
    castShadow: false,
  });
  addBox(night, 0.18, 0.16, 8, makeMaterial(COLORS.curb), -8.9, 0.44, 2.4, {
    receiveShadow: true,
    castShadow: false,
  });
  addBox(night, 0.18, 0.16, 8, makeMaterial(COLORS.curb), 8.9, 0.44, 2.4, {
    receiveShadow: true,
    castShadow: false,
  });

  // Drain grates, road lines, wet ribs and a small parking bay.
  const grateMaterial = makeMaterial(0x36525b);
  for (let index = 0; index < 7; index += 1) {
    addBox(night, 0.75, 0.018, 0.055, grateMaterial, 4.85 + index * 0.11, 0.192, 6.85, {
      castShadow: false,
    });
  }
  addBox(night, 0.055, 0.02, 1.52, grateMaterial, 4.8, 0.195, 7.25, {
    castShadow: false,
  });
  const roadLineMaterial = new THREE.MeshBasicMaterial({
    color: 0x92b5b9,
    transparent: true,
    opacity: 0.58,
  });
  for (let index = 0; index < 7; index += 1) {
    if (index === 3) continue;
    addBox(night, 0.8, 0.015, 0.06, roadLineMaterial, -7.5 + index * 2.05, 0.19, 8.0, {
      castShadow: false,
    });
  }
  for (let index = 0; index < 7; index += 1) {
    addBox(night, 0.035, 0.012, 0.38, roadLineMaterial, -7.6 + index * 2.25, 0.19, 4.5, {
      castShadow: false,
    });
  }
  for (let index = 0; index < 5; index += 1) {
    addBox(night, 1.8, 0.012, 0.035, roadLineMaterial, 4.3, 0.195, 3.65 + index * 0.78, {
      castShadow: false,
    });
  }

  // Sidewalk grid and corner faceted paving.
  addBox(night, 17.8, 0.016, 0.025, makeBasicCyanMaterial(), 0, 0.455, 0.15, {
    castShadow: false,
  });
  const sidewalkLines = new THREE.Group();
  for (let x = -8.4; x <= 8.4; x += 1.4) {
    addBox(sidewalkLines, 0.016, 0.014, 3.9, roadLineMaterial, x, 0.455, -2.2, {
      castShadow: false,
      receiveShadow: false,
    });
  }
  night.add(sidewalkLines);

  // Store.
  const storeParts = addStore(night, resources);

  // Exterior props around the store.
  addVendingMachine(night, -7.05, -1.56);
  addBicycle(night, -7.65, -0.76);
  addBollard(night, -6.15, -0.22, COLORS.cyan);
  addBollard(night, -4.25, -0.22, COLORS.blue);
  addBollard(night, 5.35, -0.22, COLORS.blue);
  addBollard(night, 7.05, -0.22, COLORS.cyan);

  const bins = new THREE.Group();
  bins.position.set(-5.5, 0.44, -0.4);
  addBox(bins, 0.38, 0.48, 0.38, makeMaterial(0x5b7375), 0, 0.24, 0);
  addBox(bins, 0.34, 0.44, 0.34, makeMaterial(0x7a8e84), 0.44, 0.22, 0.03);
  addBox(bins, 0.42, 0.04, 0.42, makeMaterial(0xb1bea8), 0, 0.49, 0);
  night.add(bins);

  const umbrellaStand = new THREE.Group();
  umbrellaStand.position.set(4.5, 0.44, -0.48);
  addBox(umbrellaStand, 0.5, 0.65, 0.38, makeMaterial(0x506869), 0, 0.32, 0);
  addBox(umbrellaStand, 0.035, 0.78, 0.035, makeMaterial(0x637f7d), -0.15, 0.5, 0.12, {
    rotation: [0.06, 0, -0.16],
  });
  addBox(umbrellaStand, 0.035, 0.74, 0.035, makeMaterial(COLORS.red), 0.08, 0.48, 0.08, {
    rotation: [-0.04, 0, 0.15],
  });
  addBox(umbrellaStand, 0.035, 0.94, 0.035, makeMaterial(COLORS.blue), 0.18, 0.58, 0.15, {
    rotation: [0.03, 0, -0.08],
  });
  night.add(umbrellaStand);

  addStoreExtras(night);
  addStreetLamp(night, -8.05, -1.1);
  addStreetLamp(night, 8.35, -1.1);
  const signalBulbs = addSignal(night);

  // Utility poles and overhead wires.
  const poleMaterial = makeMaterial(0x51686c);
  for (const x of [-8.1, 8.0]) {
    addBox(night, 0.11, 5.8, 0.11, poleMaterial, x, 2.9, -3.0);
    addBox(night, 1.1, 0.07, 0.08, poleMaterial, x, 5.35, -3.0);
  }
  const wireMaterial = new THREE.LineBasicMaterial({
    color: 0x526d72,
    transparent: true,
    opacity: 0.75,
  });
  resources.materials.push(wireMaterial);
  for (const offset of [0, 0.18, 0.36]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8.1, 5.34 - offset, -3.0),
      new THREE.Vector3(-4.2, 4.72 - offset, -3.0),
      new THREE.Vector3(0, 4.62 - offset, -3.0),
      new THREE.Vector3(4.2, 4.72 - offset, -3.0),
      new THREE.Vector3(8.0, 5.34 - offset, -3.0),
    ]);
    const wire = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(42)),
      wireMaterial,
    );
    night.add(wire);
  }

  // Puddles and luminous reflected patches.
  const puddleMaterial = new THREE.MeshBasicMaterial({
    color: 0x58c8c1,
    transparent: true,
    opacity: 0.19,
    depthWrite: false,
  });
  resources.materials.push(puddleMaterial);
  for (const [x, z, sx, sz] of [
    [-5.95, 3.05, 2.4, 0.85],
    [-0.8, 5.9, 2.4, 0.9],
    [5.85, 4.5, 2.1, 0.7],
    [3.2, 7.7, 2.5, 0.7],
  ]) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 26), puddleMaterial);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(sx, sz, 1);
    puddle.position.set(x, 0.205, z);
    night.add(puddle);
  }

  return { night, storeParts, signalBulbs };
}

function addStoreExtras(parent) {
  // Poster board and a compact corner sign.
  addBox(parent, 0.6, 0.88, 0.12, makeMaterial(0x2b4650), -4.0, 1.32, 0.13);
  addBox(parent, 0.28, 0.36, 0.025, makeBasicCyanMaterial(), -4.0, 1.48, 0.2, {
    castShadow: false,
  });
  addBox(parent, 0.3, 0.15, 0.025, makeMaterial(COLORS.coral), -4.0, 1.14, 0.2, {
    castShadow: false,
  });
  addBox(parent, 0.2, 0.52, 0.07, makeMaterial(0x4e6f72), 4.1, 1.5, -0.12);
  const signLight = new THREE.Mesh(
    new THREE.PlaneGeometry(0.25, 0.1),
    new THREE.MeshBasicMaterial({ color: COLORS.cyan }),
  );
  signLight.position.set(4.1, 1.62, -0.075);
  parent.add(signLight);
  addBox(parent, 0.3, 0.72, 0.3, makeMaterial(0x4f7173), 5.25, 0.8, -0.62);
  addBox(parent, 0.4, 0.05, 0.34, makeMaterial(0x9eb2a8), 5.25, 1.18, -0.62);
}

function createRain(scene, resources, lowPower) {
  const count = lowPower ? 180 : 380;
  const rainData = createRainGeometry({ count, seed: 4096 });
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(rainData.positions);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  resources.geometries.push(geometry);
  const material = new THREE.PointsMaterial({
    color: 0xa8d7df,
    size: 0.028,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  resources.materials.push(material);
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return { points, geometry, positions, speeds: rainData.speeds };
}

function createRipples(scene, resources) {
  const rippleMaterial = new THREE.MeshBasicMaterial({
    color: 0x98ded9,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  resources.materials.push(rippleMaterial);
  const ripples = [];
  for (let index = 0; index < 12; index += 1) {
    const geometry = new THREE.RingGeometry(0.06, 0.085, 22);
    resources.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, rippleMaterial.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(-6.2 + (index % 4) * 3.6, 0.225, 2.7 + Math.floor(index / 4) * 2.1);
    scene.add(mesh);
    ripples.push({
      mesh,
      phase: index * 0.83 + 0.3,
      speed: 0.35 + (index % 3) * 0.1,
    });
  }
  return ripples;
}

function createGlassRain(scene, resources, store) {
  const material = new THREE.LineBasicMaterial({
    color: 0xc8f1e8,
    transparent: true,
    opacity: 0.24,
  });
  resources.materials.push(material);
  const streaks = [];
  for (let index = 0; index < 14; index += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, index % 3 === 0 ? 0.34 : 0.22, 0),
    ]);
    resources.geometries.push(geometry);
    const line = new THREE.Line(geometry, material);
    line.position.set(-3.2 + (index % 7) * 0.99, 1.52 + (index % 4) * 0.27, 2.1);
    store.add(line);
    streaks.push({ line, phase: index * 0.71, speed: 0.22 + (index % 3) * 0.08 });
  }
  return streaks;
}

function createCamera(mount) {
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 90);
  const target = new THREE.Vector3(0, 1.72, 0.28);
  const orbit = { yaw: 0.7, pitch: 0.27, distance: 16.2 };
  return { camera, target, orbit };
}

function syncCamera(camera, target, orbit) {
  syncOrbitCamera(camera, target, orbit);
}

function addPointerOrbit(mount, orbit, reset, render) {
  return createOrbitController(mount, orbit, reset, render);
}

function createSky(scene, resources) {
  const geometry = new THREE.BufferGeometry();
  const stars = new Float32Array(160 * 3);
  for (let index = 0; index < 160; index += 1) {
    stars[index * 3] = -22 + ((index * 37) % 440) / 10;
    stars[index * 3 + 1] = 6 + ((index * 13) % 70) / 10;
    stars[index * 3 + 2] = -22 + ((index * 19) % 180) / 10;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  resources.geometries.push(geometry);
  const material = new THREE.PointsMaterial({
    color: 0x8aaec3,
    size: 0.025,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  resources.materials.push(material);
  scene.add(new THREE.Points(geometry, material));
}

export function createRainyStoreScene({
  mount,
  reducedMotion = false,
  screenshotMode = false,
  onFailure,
}) {
  if (!mount) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
  } catch (error) {
    console.warn("RainyStoreScene: WebGL unavailable.", error);
    onFailure?.(error);
    return null;
  }

  const resources = { geometries: [], materials: [], textures: [] };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.night);
  scene.fog = new THREE.FogExp2(COLORS.night, 0.025);
  const lowPower = window.matchMedia?.("(max-width: 1023px)")?.matches
    || (navigator.hardwareConcurrency || 8) <= 4;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.65);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.className = "tt-rainy-canvas";
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "Interactive rainy convenience store miniature");
  mount.appendChild(renderer.domElement);

  const { camera, target, orbit } = createCamera(mount);
  syncCamera(camera, target, orbit);
  const defaultOrbit = { ...orbit };

  scene.add(new THREE.HemisphereLight(0x94bdcb, 0x1b3035, 1.1));
  const moon = new THREE.DirectionalLight(0xb0d3ea, 2.35);
  moon.position.set(-10, 16, 10);
  moon.castShadow = !lowPower;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -13;
  moon.shadow.camera.right = 13;
  moon.shadow.camera.top = 14;
  moon.shadow.camera.bottom = -10;
  scene.add(moon);
  createSky(scene, resources);

  const { night, storeParts, signalBulbs } = addStreetWorld(scene, resources);
  const rain = createRain(scene, resources, lowPower);
  const ripples = createRipples(scene, resources);
  const glassRain = createGlassRain(scene, resources, storeParts.store);

  const resize = () => {
    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 500 ? 44 : 38;
    camera.updateProjectionMatrix();
  };
  resize();
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(resize)
    : null;
  resizeObserver?.observe(mount);

  let inView = true;
  const intersectionObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
    }, { threshold: 0 })
    : null;
  intersectionObserver?.observe(mount);

  let hidden = document.visibilityState === "hidden";
  const onVisibility = () => {
    hidden = document.visibilityState === "hidden";
  };
  document.addEventListener("visibilitychange", onVisibility);

  const reduceMotion = reducedMotion
    || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    || false;
  let frameId = 0;
  let disposed = false;
  const timer = new THREE.Timer();
  let elapsed = 0;
  let lastDoor = 0;
  let lastDoorToggle = 0;
  let signFlickerUntil = 0;
  let nextFlicker = 7;

  const resetView = () => {
    Object.assign(orbit, defaultOrbit);
    syncCamera(camera, target, orbit);
    renderer.render(scene, camera);
  };
  const removePointerOrbit = addPointerOrbit(mount, orbit, resetView, () => {
    syncCamera(camera, target, orbit);
    renderer.render(scene, camera);
  });

  const animateRain = (dt) => {
    if (reduceMotion) return;
    const positionAttribute = rain.geometry.attributes.position;
    for (let index = 0; index < rain.speeds.length; index += 1) {
      const offset = index * 3;
      rain.positions[offset + 1] -= rain.speeds[index] * dt;
      if (rain.positions[offset + 1] < 0.25) {
        rain.positions[offset] = (((rain.positions[offset] + 13) % 18) + 18) % 18 - 9;
        rain.positions[offset + 1] = 9 + (index % 7) * 0.24;
      }
    }
    positionAttribute.needsUpdate = true;
  };

  const animate = (time) => {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    timer.update(time);
    elapsed = timer.getElapsed();
    if (shouldAnimate({ hidden, inView, reducedMotion: reduceMotion, screenshotMode })) {
      const dt = Math.min(timer.getDelta(), 0.05);
      animateRain(dt);
      ripples.forEach(({ mesh, phase, speed }) => {
        const pulse = (elapsed * speed + phase) % 1;
        mesh.scale.setScalar(0.4 + pulse * 2.4);
        mesh.material.opacity = Math.max(0, 0.27 * (1 - pulse));
      });
      glassRain.forEach(({ line, phase, speed }) => {
        const drop = (elapsed * speed + phase) % 1;
        line.position.y = 2.63 - drop * 1.15;
        line.material.opacity = 0.12 + (1 - drop) * 0.14;
      });
      storeParts.interiorLight.intensity = 14.4 + Math.sin(elapsed * 1.2) * 0.5;
      storeParts.displayLight.intensity = 6.7 + Math.sin(elapsed * 1.7 + 2) * 0.3;
      storeParts.antenna.scale.setScalar(1 + Math.sin(elapsed * 2.8) * 0.13);
      if (elapsed > nextFlicker) {
        signFlickerUntil = elapsed + 0.09;
        nextFlicker = elapsed + 8 + (elapsed % 5);
      }
      storeParts.mainSignMaterial.opacity = elapsed < signFlickerUntil ? 0.55 : 1;
      storeParts.mainSignMaterial.transparent = elapsed < signFlickerUntil;
      const doorTarget = (elapsed % 13) > 10.7 ? 0.72 : 0;
      lastDoor += (doorTarget - lastDoor) * Math.min(1, dt * 3.5);
      storeParts.door.position.x = 2.0 + lastDoor;
      const signalIndex = Math.floor(elapsed / 6) % 3;
      signalBulbs.forEach((bulb, index) => {
        bulb.material.opacity = index === signalIndex ? 1 : 0.22;
      });
      if (elapsed - lastDoorToggle > 2.2) {
        lastDoorToggle = elapsed;
      }
      syncCamera(camera, target, orbit);
      renderer.render(scene, camera);
    }
  };

  renderer.render(scene, camera);
  frameId = requestAnimationFrame(animate);

  return {
    resetView,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      removePointerOrbit();
      night.clear();
      scene.clear();
      disposeScene3D({
        geometries: resources.geometries,
        materials: resources.materials,
        textures: resources.textures,
        renderer,
      });
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    },
  };
}
