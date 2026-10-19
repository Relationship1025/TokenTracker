import { describe, expect, it, vi } from "vitest";
import {
  clampOrbit,
  createRainGeometry,
  disposeScene3D,
  shouldAnimate,
} from "./rainy-store-runtime.js";

describe("rainy store scene runtime", () => {
  it("keeps camera above the base and inside zoom bounds", () => {
    expect(clampOrbit({ yaw: 50, pitch: -2, distance: 1 })).toEqual({
      yaw: 50,
      pitch: 0.12,
      distance: 12,
    });
    expect(clampOrbit({ yaw: 0, pitch: 3, distance: 99 })).toEqual({
      yaw: 0,
      pitch: 0.78,
      distance: 26,
    });
  });

  it("creates deterministic rain positions for a seed", () => {
    const a = createRainGeometry({ count: 8, seed: 42 });
    const b = createRainGeometry({ count: 8, seed: 42 });
    expect(a).toEqual(b);
    expect(a.positions).toHaveLength(24);
    expect(a.speeds).toHaveLength(8);
  });

  it("pauses all decorative animation for hidden, offscreen, reduced, or screenshot modes", () => {
    expect(shouldAnimate({ hidden: false, inView: true, reducedMotion: false, screenshotMode: false })).toBe(true);
    expect(shouldAnimate({ hidden: true, inView: true, reducedMotion: false, screenshotMode: false })).toBe(false);
    expect(shouldAnimate({ hidden: false, inView: false, reducedMotion: false, screenshotMode: false })).toBe(false);
    expect(shouldAnimate({ hidden: false, inView: true, reducedMotion: true, screenshotMode: false })).toBe(false);
    expect(shouldAnimate({ hidden: false, inView: true, reducedMotion: false, screenshotMode: true })).toBe(false);
  });

  it("disposes every retained GPU resource exactly once", () => {
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn() };
    const texture = { dispose: vi.fn() };
    const renderer = {
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
      renderLists: { dispose: vi.fn() },
    };
    disposeScene3D({ geometries: [geometry], materials: [material], textures: [texture], renderer });
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(texture.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer.renderLists.dispose).toHaveBeenCalledTimes(1);
  });
});
