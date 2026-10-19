import React from "react";
import { copy } from "../../../lib/copy";

/**
 * Deterministic miniature used for narrow screens, reduced motion, screenshot
 * capture, and WebGL failure. The artwork itself contains no UI or text.
 */
export function RainyStoreStatic({ className = "", priority = false }) {
  return (
    <div className={`tt-rainy-static ${className}`} data-rainy-store-mode="static">
      <img
        src="/rainy-store-diorama.svg"
        alt={copy("dashboard.rainy_store.description")}
        width="1024"
        height="1024"
        loading={priority ? "eager" : "lazy"}
        draggable="false"
        data-rainy-store-mode="static"
      />
    </div>
  );
}
