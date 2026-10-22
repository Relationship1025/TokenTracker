export const THEME_STORAGE_KEY = "tokentracker-theme";
export const NEON_STORE_PERIOD_KEY = "tokentracker-neon-store-period";

export const THEME_VALUES = Object.freeze([
  "light",
  "dark",
  "system",
  "neon-store",
]);

export const NEON_STORE_PERIODS = Object.freeze(["night", "day"]);

export function isThemeValue(value) {
  return typeof value === "string" && THEME_VALUES.includes(value);
}

export function isNeonStorePeriod(value) {
  return typeof value === "string" && NEON_STORE_PERIODS.includes(value);
}

export function getInitialTheme(storage = globalThis.localStorage) {
  if (!storage) return "light";
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    // System theme was removed from the picker; map legacy value to classic light/dark.
    if (stored === "system") {
      const dark = globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      return dark ? "dark" : "light";
    }
    if (isThemeValue(stored)) return stored;
  } catch {
    // localStorage may be unavailable in private or embedded contexts.
  }
  return "light";
}

/** @returns {"night" | "day"} */
export function getInitialNeonStorePeriod(storage = globalThis.localStorage) {
  if (!storage) return "night";
  try {
    const stored = storage.getItem(NEON_STORE_PERIOD_KEY);
    if (isNeonStorePeriod(stored)) return stored;
  } catch {
    // ignore
  }
  return "night";
}

export function resolveThemeClass(theme, systemDark) {
  if (theme === "dark" || theme === "neon-store") return "dark";
  if (theme === "light") return "light";
  return systemDark ? "dark" : "light";
}

/** Light + dark are one "Classic" family in the theme picker UI. */
export function isClassicTheme(theme) {
  return theme === "light" || theme === "dark";
}

/** Map stored theme → segmented/menu control value (`classic` | `system` | `neon-store`). */
export function themeControlValue(theme) {
  if (isClassicTheme(theme)) return "classic";
  return theme;
}

/**
 * Map control value back to a stored theme.
 * Classic keeps the current light/dark when already classic; otherwise uses resolvedTheme.
 */
export function themeFromControlValue(value, resolvedTheme, currentTheme) {
  if (value !== "classic") return value;
  if (isClassicTheme(currentTheme)) return currentTheme;
  return resolvedTheme === "dark" ? "dark" : "light";
}
