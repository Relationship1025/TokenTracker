import React, { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../../lib/cn";

const RainyDockOverlayContext = createContext(null);

/**
 * Optional dock API for overlays mounted inside rainy cards (e.g. trend zoom).
 * Outside RainyDashboardLayout this is null and callers no-op.
 */
export function useRainyDockOverlay() {
  return useContext(RainyDockOverlayContext);
}

/**
 * Rainy-store Overview: full-bleed scene with a bottom card dock.
 * Collapsed: horizontal title chips + pull handle.
 * Expanded: frosted floating card pane (> half viewport) toggled by the handle.
 *
 * Overlays can temporarily collapse the dock without unmounting cards so
 * in-card fixed modals stay alive, then restore the prior expanded state.
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
  const [overlayHold, setOverlayHold] = useState(false);
  const expandedBeforeOverlayRef = useRef(null);
  const panelId = useId();

  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const notifyOverlayOpen = useCallback(() => {
    setOverlayHold((holding) => {
      if (!holding) {
        expandedBeforeOverlayRef.current = expandedRef.current;
      }
      return true;
    });
    setExpanded(false);
  }, []);

  const notifyOverlayClose = useCallback(() => {
    const restore = expandedBeforeOverlayRef.current;
    expandedBeforeOverlayRef.current = null;
    setOverlayHold(false);
    if (restore != null) setExpanded(restore);
  }, []);

  const overlayApi = useMemo(
    () => ({ notifyOverlayOpen, notifyOverlayClose }),
    [notifyOverlayOpen, notifyOverlayClose],
  );

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

  // Visual dock follows user expanded state; overlay forces collapsed chrome.
  const dockOpen = expanded && !overlayHold;
  // Always keep the card tree mounted (hidden via CSS when collapsed) so
  // SortableCard can report empty/null cards and the collapsed chip strip
  // omits phantom labels. Overlay-hold still uses the dedicated hold grid class.

  return (
    <RainyDockOverlayContext.Provider value={overlayApi}>
      <div
        className={cn(
          "tt-rainy-dashboard tt-rainy-dashboard--wide",
          dockOpen ? "tt-rainy-dashboard--dock-open" : "tt-rainy-dashboard--dock-closed",
          overlayHold && "tt-rainy-dashboard--overlay-hold",
          className,
        )}
        data-rainy-layout="wide"
        data-rainy-dock={dockOpen ? "open" : "closed"}
        data-rainy-overlay={overlayHold ? "hold" : "off"}
      >
        <div className="tt-rainy-scene-pane" data-rainy-scene-pane>
          {scene}
        </div>

        <div
          className={cn(
            "tt-rainy-card-pane",
            dockOpen ? "tt-rainy-card-pane--expanded" : "tt-rainy-card-pane--collapsed",
            overlayHold && "tt-rainy-card-pane--overlay-hold",
          )}
          data-rainy-card-pane
          id={panelId}
        >
          <button
            type="button"
            className="tt-rainy-dock-handle"
            aria-expanded={dockOpen}
            aria-controls={panelId}
            onClick={() => {
              if (overlayHold) return;
              setExpanded((v) => !v);
            }}
          >
            <span className="tt-rainy-dock-handle-bar" aria-hidden="true" />
            <span className="sr-only">{dockOpen ? "Collapse cards" : "Expand cards"}</span>
          </button>

          {!dockOpen && (
            <div className="tt-rainy-dock-titles" aria-label="Dashboard cards">
              {dockTitles.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="tt-rainy-dock-title-chip"
                  onClick={() => {
                    if (overlayHold) return;
                    setExpanded(true);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div
            className={cn(
              "tt-rainy-card-grid",
              !dockOpen && !overlayHold && "tt-rainy-card-grid--dock-collapsed",
              overlayHold && !expanded && "tt-rainy-card-grid--overlay-hold",
            )}
          >
            <div className="flex min-w-0 flex-col gap-4">{leftColumn}</div>
            <div className="flex min-w-0 flex-col gap-4">{rightColumn}</div>
          </div>
        </div>
      </div>
    </RainyDockOverlayContext.Provider>
  );
}
