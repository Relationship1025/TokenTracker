import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripHorizontal, X } from "lucide-react";
import { copy, setCopyLocale } from "./copy";
import { widgetThemeClasses } from "./widget-theme.js";
import "../widget.css";

/**
 * Shared shell for the native desktop widget pages (summary / heatmap / top
 * models / limits), mirroring quota.jsx's contract with the Windows host
 * (DesktopWidgetWindowBase): handshake `<prefix>:ready`, context pushes
 * `<prefix>:context` carrying { data, selected?, locale, light, failed }, and
 * control messages `<prefix>:expand|collapse|close|drag|dashboard`. The render
 * callback receives the decoded context pieces.
 */
export function WidgetShell({ prefix, children }) {
  const [context, setContext] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const drag = useRef(null);

  useEffect(() => {
    const receive = event => {
      if (event.data?.type !== `${prefix}:context`) return;
      setCopyLocale(event.data.locale);
      setContext(event.data);
    };
    window.chrome?.webview?.addEventListener("message", receive);
    window.chrome?.webview?.postMessage(`${prefix}:ready`);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearInterval(timer);
      window.chrome?.webview?.removeEventListener("message", receive);
    };
  }, [prefix]);

  useEffect(() => {
    const onKey = event => {
      if (event.key === "Escape") {
        setExpanded(false);
        window.chrome?.webview?.postMessage(`${prefix}:collapse`);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prefix]);

  const send = message => window.chrome?.webview?.postMessage(message);
  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    send(next ? `${prefix}:expand` : `${prefix}:collapse`);
  };
  const light = context?.light === true;
  const failed = context?.failed === true;

  return (
    <main className={`widget ${widgetThemeClasses(context?.style, light)} ${expanded ? "expanded" : ""} ${failed ? "stale" : ""}`}>
      <header>
        {expanded ? (
          <span className="widget-title">{copy(`widget.${prefix}.title`)}</span>
        ) : (
          <span className={`widget-status ${failed ? "stale-status" : ""}`} role="status" aria-label={failed ? copy("quota.stale") : undefined}>{failed ? "!" : null}</span>
        )}
        <button
          className="drag-handle"
          aria-label={copy("quota.drag")}
          title={copy("quota.drag")}
          onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY }; }}
          onPointerMove={event => {
            if (drag.current && event.buttons === 1 && Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 4) {
              drag.current = null;
              send(`${prefix}:drag`);
            }
          }}
          onPointerUp={() => { drag.current = null; }}
        >
          <GripHorizontal size={14} />
        </button>
        <button
          className="widget-toggle"
          aria-label={copy(expanded ? "quota.collapse" : "quota.expand")}
          aria-expanded={expanded}
          onClick={toggle}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          className="widget-close"
          aria-label={copy("quota.close")}
          title={copy("quota.close_hint")}
          onClick={() => send(`${prefix}:close`)}
        >
          <X size={14} />
        </button>
      </header>
      {children({
        data: context?.data ?? null,
        selected: Array.isArray(context?.selected) ? context.selected : [],
        locale: context?.locale,
        failed,
        expanded,
        send,
        now,
      })}
    </main>
  );
}
