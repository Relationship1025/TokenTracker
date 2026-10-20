import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildKonbiniDiorama,
  classifyKonbiniMaterial,
  createToonGradient,
  isAnimatedKonbiniNode,
  createHeightField,
  readMaterialTone,
  shouldOutline,
  toneOverrideFor,
} from "./rainy-konbini-loader.js";
import { createSceneResourceRegistry } from "./rainy-store-runtime.js";
import { createEdgeDripSpots, doorOpenAmount, signFlicker, signalColorAt } from "./rainy-store-scene.js";

function toonSource(name, color, emit = 0) {
  const material = new THREE.MeshStandardMaterial({ name });
  material.userData = { tt_color: color, tt_emit: emit };
  return material;
}

describe("konbini glTF loader", () => {
  it("classifies special materials by Blender name", () => {
    expect(classifyKonbiniMaterial("Glass")).toBe("glass");
    expect(classifyKonbiniMaterial("Puddle")).toBe("puddle");
    expect(classifyKonbiniMaterial("Sign.001")).toBe("sign");
    expect(classifyKonbiniMaterial("TL_R")).toBe("signal-red");
    expect(classifyKonbiniMaterial("Wall")).toBe("static");
    expect(isAnimatedKonbiniNode("DoorL")).toBe(true);
    expect(isAnimatedKonbiniNode("DoorLFrame")).toBe(false);
    expect(shouldOutline("glass", 2)).toBe(false);
    expect(shouldOutline("static", 0.01)).toBe(false);
  });

  it("builds a stepped toon gradient and reads exported tone extras", () => {
    const gradient = createToonGradient();
    expect(gradient.magFilter).toBe(THREE.NearestFilter);
    expect(gradient.image.width).toBe(3);
    expect(readMaterialTone(toonSource("Sign", [1, 0.5, 0], 4))).toEqual({ color: [1, 0.5, 0], emit: 4 });
  });

  it("merges static meshes, keeps animated parts live and tracks every resource", () => {
    const gltf = new THREE.Group();
    const box = () => new THREE.BoxGeometry(1, 1, 1);
    const wallA = new THREE.Mesh(box(), toonSource("Wall", [1, 1, 1]));
    const wallB = new THREE.Mesh(box(), wallA.material);
    wallB.position.x = 2;
    const door = new THREE.Mesh(box(), toonSource("Glass", [1, 1, 1]));
    door.name = "DoorL";
    const handle = new THREE.Mesh(box(), toonSource("Metal", [0.5, 0.5, 0.5]));
    door.add(handle);
    const sign = new THREE.Mesh(box(), toonSource("Sign", [0.2, 0.8, 0.4], 4));
    const signal = new THREE.Mesh(box(), toonSource("TL_G", [0, 1, 0], 8));
    gltf.add(wallA, wallB, door, sign, signal);

    const registry = createSceneResourceRegistry();
    const { root, parts } = buildKonbiniDiorama(gltf, registry);
    expect(parts.doors.DoorL.children).toHaveLength(2);
    expect(parts.signs).toHaveLength(1);
    expect(parts.signals.green).toHaveLength(1);
    expect(root.children.find((c) => c.name === "static:Wall")).toBeTruthy();
    expect(root.children.find((c) => c.name === "outlines")).toBeTruthy();
    expect(registry.textures).toHaveLength(1);
    root.traverse((node) => {
      if (node.isMesh) {
        expect(registry.geometries).toContain(node.geometry);
        expect(registry.materials).toContain(node.material);
      }
    });
  });
});

describe("konbini animation timing", () => {
  it("cycles the signal green -> yellow -> red", () => {
    expect(signalColorAt(1)).toBe("green");
    expect(signalColorAt(11)).toBe("yellow");
    expect(signalColorAt(20)).toBe("red");
    expect(signalColorAt(25)).toBe("green");
  });

  it("opens and closes the auto door within each loop", () => {
    expect(doorOpenAmount(2)).toBe(0);
    expect(doorOpenAmount(11.5)).toBe(1);
    expect(doorOpenAmount(13.8)).toBe(0);
  });

  it("flickers the sign briefly", () => {
    expect(signFlicker(1)).toBe(1);
    expect(signFlicker(6.04)).toBeLessThan(1);
  });
});

describe("konbini weather helpers", () => {
  it("rasterises roof heights so rain stops on top of buildings", () => {
    const box = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2.9, 1));
    const field = createHeightField([box], { size: 16, extent: 4 });
    expect(field.heightAt(0, 0)).toBeCloseTo(2.9);
    expect(field.heightAt(3, 3)).toBe(0);
    expect(field.heightAt(9, 0)).toBe(-0.7);
  });

  it("uses neutral wall and charcoal roof tones", () => {
    const roof = toneOverrideFor("Roof", "White");
    expect(Math.max(...roof)).toBeLessThan(0.25);
    const wall = toneOverrideFor("RightWall", "Wall");
    expect(wall[0]).toBeGreaterThan(wall[2]);
    expect(toneOverrideFor("Shelf3", "Wood")).toBeNull();
  });

  it("spawns drips along awning and roof edges", () => {
    const spots = createEdgeDripSpots();
    expect(spots.length).toBeGreaterThan(20);
    expect(spots.some((s) => s.x < -2.7)).toBe(true);
    expect(spots.some((s) => s.x > 2.7)).toBe(true);
  });
});
