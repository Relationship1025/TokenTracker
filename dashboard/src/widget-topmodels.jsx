import React from "react";
import { createRoot } from "react-dom/client";
import { copy } from "./lib/copy";
import { WidgetShell } from "./lib/widget-shell.jsx";

/* Context data (from UsagePoller.UsageStats.TopModels, serialized by the tray
 * host): { models: Array<{ name, percent, source }> — already top-5, sorted. */

const SOURCE_COLORS = {
  claude: "#C77DFF",
  codex: "#34C759",
  cursor: "#FFCC00",
  gemini: "#0A84FF",
  grok: "#E68C59",
  kimi: "#5A8CF2",
};

function sourceColor(source) {
  return SOURCE_COLORS[source] ?? "#9973E6";
}

export function TopModelsWidget() {
  return (
    <WidgetShell prefix="topmodels">
      {({ data, expanded }) => {
        const models = Array.isArray(data?.models) ? data.models.filter(model => model?.name) : [];
        if (!models.length) {
          return <div className="widget-empty">{copy(data ? "widget.no_models" : "widget.loading")}</div>;
        }
        return (
          <div className={`widget-body wm ${expanded ? "wm-expanded" : ""}`}>
            {models.slice(0, expanded ? 7 : 5).map((model, index) => {
              const percent = Math.min(100, Math.max(0, Number(model.percent) || 0));
              return (
                <div className="wm-row" key={`${model.name}-${index}`}>
                  <span className="wm-dot" style={{ background: sourceColor(model.source) }} aria-hidden="true" />
                  <span className="wm-name" title={`${model.name}${model.source ? ` · ${model.source}` : ""}`}>{model.name}</span>
                  <span className="wm-pct">{percent.toFixed(1)}%</span>
                  <span className="wm-bar" aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        );
      }}
    </WidgetShell>
  );
}

const root = document.getElementById("widget-topmodels-root");
if (root) createRoot(root).render(<TopModelsWidget />);
