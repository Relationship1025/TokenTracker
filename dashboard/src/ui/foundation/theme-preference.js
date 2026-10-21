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
  if (!storage) return "system";
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    if (isThemeValue(stored)) return stored;
  } catch {
    // localStorage may be unavailable in private or embedded contexts.
  }
  return "system";
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
