import React, { useId, useState } from "react";
import { cn } from "../../../lib/cn";

/**
 * Rainy-store Overview: full-bleed scene with a bottom card dock.
 * Collapsed: horizontal title chips + pull handle.
 * Expanded: frosted floating card pane (> half viewport) toggled by the handle.
 */
export function RainyDashboardLayout({
  scene,
  leftColumn,
  rightColumn,
  dockTitles = [],
  narrow = false,
  className = "",
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(Boolean(defaultExpanded));
  const panelId = useId();

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
      className={cn(
        "tt-rainy-dashboard tt-rainy-dashboard--wide",
        expanded ? "tt-rainy-dashboard--dock-open" : "tt-rainy-dashboard--dock-closed",
        className,
      )}
      data-rainy-layout="wide"
      data-rainy-dock={expanded ? "open" : "closed"}
    >
      <div className="tt-rainy-scene-pane" data-rainy-scene-pane>
        {scene}
      </div>

      <div
        className={cn(
          "tt-rainy-card-pane",
          expanded ? "tt-rainy-card-pane--expanded" : "tt-rainy-card-pane--collapsed",
        )}
        data-rainy-card-pane
        id={panelId}
      >
        <button
          type="button"
          className="tt-rainy-dock-handle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="tt-rainy-dock-handle-bar" aria-hidden="true" />
          <span className="sr-only">{expanded ? "Collapse cards" : "Expand cards"}</span>
        </button>

        {!expanded && (
          <div className="tt-rainy-dock-titles" aria-label="Dashboard cards">
            {dockTitles.map((item) => (
              <button
                key={item.id}
                type="button"
                className="tt-rainy-dock-title-chip"
                onClick={() => setExpanded(true)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {expanded && (
          <div className="tt-rainy-card-grid">
            <div className="flex min-w-0 flex-col gap-4">{leftColumn}</div>
            <div className="flex min-w-0 flex-col gap-4">{rightColumn}</div>
          </div>
        )}
      </div>
    </div>
  );
}
