import React, { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { copy } from "../../../lib/copy";
import { RainyStoreStatic } from "./RainyStoreStatic.jsx";

function detectReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Lazy, theme-only Three.js diorama. The scene module and the Three.js runtime
 * are imported only after a desktop dashboard actually requests the live mode.
 */
export function RainyStoreScene({
  active = true,
  reducedMotion = false,
  screenshotMode = false,
  daytime = false,
  className = "",
}) {
  const mountRef = useRef(null);
  const controllerRef = useRef(null);
  const daytimeRef = useRef(daytime);
  const [webglFailed, setWebglFailed] = useState(false);
  const [ready, setReady] = useState(false);
  daytimeRef.current = daytime;

  useEffect(() => {
    if (!active || reducedMotion || screenshotMode) {
      setReady(false);
      return undefined;
    }
    const mount = mountRef.current;
    if (!mount) return undefined;

    let cancelled = false;
    let controller = null;
    setWebglFailed(false);
    setReady(false);

    import("./rainy-store-scene.js")
      .then((module) => {
        if (cancelled || !mount.isConnected) return;
        controller = module.createRainyStoreScene({
          mount,
          reducedMotion: reducedMotion || detectReducedMotion(),
          screenshotMode,
          daytime: daytimeRef.current,
          onFailure: () => {
            if (!cancelled) setWebglFailed(true);
          },
        });
        if (!controller) {
          setWebglFailed(true);
          return;
        }
        controllerRef.current = controller;
        controller.setDaytime?.(daytimeRef.current);
        setReady(true);
      })
      .catch((error) => {
        console.warn("RainyStoreScene: unable to initialize WebGL scene.", error);
        if (!cancelled) setWebglFailed(true);
      });

    return () => {
      cancelled = true;
      controller?.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [active, reducedMotion, screenshotMode]);

  useEffect(() => {
    controllerRef.current?.setDaytime?.(daytime);
  }, [daytime]);

  if (!active || reducedMotion || screenshotMode || webglFailed) {
    return <RainyStoreStatic className={className} priority={active} />;
  }

  return (
    <div
      className={`tt-rainy-scene ${className}`}
      data-rainy-store-mode={ready ? "webgl" : "loading"}
      data-rainy-period={daytime ? "day" : "night"}
    >
      <div ref={mountRef} className="tt-rainy-canvas-mount" />
      <button
        type="button"
        className="tt-rainy-reset"
        aria-label={copy("dashboard.rainy_store.reset_view")}
        title={copy("dashboard.rainy_store.reset_view")}
        onClick={() => controllerRef.current?.resetView()}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="sr-only">{copy("dashboard.rainy_store.canvas_description")}</span>
    </div>
  );
}
