import React from "react";
import { cn } from "../../../lib/cn";

/**
 * The rainy-store Overview composition. The store is unframed stage content;
 * card streams keep their existing rendering and scroll independently.
 */
export function RainyDashboardLayout({
  scene,
  leftColumn,
  rightColumn,
  narrow = false,
  className = "",
}) {
  if (narrow) {
    return (
      <div
        className={cn("tt-rainy-dashboard tt-rainy-dashboard--narrow", className)}
        data-rainy-layout="narrow"
      >
        <div className="tt-rainy-narrow-scene" data-rainy-scene-pane>
          {scene}
        </div>
        <div className="tt-rainy-narrow-stream">
          <div className="flex min-w-0 flex-col gap-4">{leftColumn}</div>
          <div className="flex min-w-0 flex-col gap-4">{rightColumn}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("tt-rainy-dashboard tt-rainy-dashboard--wide", className)}
      data-rainy-layout="wide"
    >
      <div className="tt-rainy-scene-pane" data-rainy-scene-pane>
        {scene}
      </div>
      <div className="tt-rainy-card-pane" data-rainy-card-pane>
        <div className="tt-rainy-card-grid">
          <div className="flex min-w-0 flex-col gap-4">{leftColumn}</div>
          <div className="flex min-w-0 flex-col gap-4">{rightColumn}</div>
        </div>
      </div>
    </div>
  );
}
