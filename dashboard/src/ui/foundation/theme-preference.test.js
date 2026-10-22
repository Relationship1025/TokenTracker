import { describe, expect, it } from "vitest";
import {
  getInitialTheme,
  getInitialNeonStorePeriod,
  isThemeValue,
  isNeonStorePeriod,
  resolveThemeClass,
  isClassicTheme,
  themeControlValue,
  themeFromControlValue,
  THEME_STORAGE_KEY,
  NEON_STORE_PERIOD_KEY,
} from "./theme-preference.js";

describe("rainy neon store theme preference", () => {
  it("recognizes the fourth persisted theme without changing legacy fallback", () => {
    expect(isThemeValue("neon-store")).toBe(true);
    expect(isThemeValue("unknown")).toBe(false);
    expect(getInitialTheme({ getItem: () => "neon-store" })).toBe("neon-store");
    expect(getInitialTheme({ getItem: () => "unknown" })).toBe("light");
  });

  it("resolves neon-store to dark and migrates legacy system on read", () => {
    expect(resolveThemeClass("neon-store", false)).toBe("dark");
    expect(resolveThemeClass("system", false)).toBe("light");
    expect(resolveThemeClass("system", true)).toBe("dark");
    expect(getInitialTheme({ getItem: () => "system" })).toMatch(/^(light|dark)$/);
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

describe("classic theme family", () => {
  it("groups light and dark under classic in the picker", () => {
    expect(isClassicTheme("light")).toBe(true);
    expect(isClassicTheme("dark")).toBe(true);
    expect(isClassicTheme("system")).toBe(false);
    expect(themeControlValue("light")).toBe("classic");
    expect(themeControlValue("neon-store")).toBe("neon-store");
  });

  it("maps classic control back to light/dark without dropping an existing classic choice", () => {
    expect(themeFromControlValue("classic", "dark", "light")).toBe("light");
    expect(themeFromControlValue("classic", "dark", "system")).toBe("dark");
    expect(themeFromControlValue("neon-store", "light", "system")).toBe("neon-store");
  });
});
