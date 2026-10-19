import { describe, expect, it } from "vitest";
import {
  getInitialTheme,
  isThemeValue,
  resolveThemeClass,
  THEME_STORAGE_KEY,
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
});
