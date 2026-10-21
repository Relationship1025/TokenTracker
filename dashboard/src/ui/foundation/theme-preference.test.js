import { describe, expect, it } from "vitest";
import {
  getInitialTheme,
  getInitialNeonStorePeriod,
  isThemeValue,
  isNeonStorePeriod,
  resolveThemeClass,
  THEME_STORAGE_KEY,
  NEON_STORE_PERIOD_KEY,
} from "./theme-preference.js";

describe("rainy neon store theme preference", () => {
  it("recognizes the fourth persisted theme without changing legacy fallback", () => {
    expect(isThemeValue("neon-store")).toBe(true);
    expect(isThemeValue("unknown")).toBe(false);
    expect(getInitialTheme({ getItem: () => "neon-store" })).toBe("neon-store");
    expect(getInitialTheme({ getItem: () => "unknown" })).toBe("system");
  });

  it("resolves neon-store to dark while leaving system dynamic", () => {
    expect(resolveThemeClass("neon-store", false)).toBe("dark");
    expect(resolveThemeClass("system", false)).toBe("light");
    expect(resolveThemeClass("system", true)).toBe("dark");
  });

  it("uses the stable storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("tokentracker-theme");
  });

  it("reads neon-store day/night period from storage", () => {
    expect(NEON_STORE_PERIOD_KEY).toBe("tokentracker-neon-store-period");
    expect(isNeonStorePeriod("day")).toBe(true);
    expect(isNeonStorePeriod("dusk")).toBe(false);
    expect(getInitialNeonStorePeriod({ getItem: () => "day" })).toBe("day");
    expect(getInitialNeonStorePeriod({ getItem: () => "nope" })).toBe("night");
  });
});
