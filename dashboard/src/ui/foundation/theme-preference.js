export const THEME_STORAGE_KEY = "tokentracker-theme";

export const THEME_VALUES = Object.freeze([
  "light",
  "dark",
  "system",
  "neon-store",
]);

export function isThemeValue(value) {
  return typeof value === "string" && THEME_VALUES.includes(value);
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

export function resolveThemeClass(theme, systemDark) {
  if (theme === "dark" || theme === "neon-store") return "dark";
  if (theme === "light") return "light";
  return systemDark ? "dark" : "light";
}
