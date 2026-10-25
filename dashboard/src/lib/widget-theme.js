/**
 * Map the native widget context's theme fields onto CSS classes.
 * `style` is pushed by the Windows host: "classic-dark" | "classic-light" |
 * "store-day" | "store-night" (the neon-store theme's two variants).
 * Older hosts only push `light`, so fall back to it when `style` is absent.
 */
export function widgetThemeClasses(style, light) {
  if (style === "store-day") return "store store-day";
  if (style === "store-night") return "store store-night";
  return light ? "light" : "";
}
