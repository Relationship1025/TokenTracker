import React from "react";
import { createRoot } from "react-dom/client";
import { copy } from "./lib/copy";
import { formatTokensCompact } from "./lib/format-tokens.js";
import { WidgetShell } from "./lib/widget-shell.jsx";

/* Context data is the raw /functions/tokentracker-usage-heatmap payload:
 * { weeks: Array<Array<{ day, total_tokens, billable_total_tokens, level } | null>>,
 *   active_days, total_cost_usd, from, to } */

export function HeatmapWidget() {
  return (
    <WidgetShell prefix="heatmap">
      {({ data, expanded }) => {
        const weeks = Array.isArray(data?.weeks) ? data.weeks.filter(week => Array.isArray(week)) : null;
        if (!weeks?.length) {
          return <div className="widget-empty">{copy("widget.loading")}</div>;
        }
        return (
          <div className={`widget-body whm ${expanded ? "whm-expanded" : ""}`}>
            <div className="whm-grid" role="img" aria-label={copy("widget.heatmap.title")}>
              {weeks.map((week, index) => (
                <div className="whm-week" key={index}>
                  {(week ?? []).map((cell, cellIndex) =>
                    cell ? (
                      <span
                        key={cell.day ?? cellIndex}
                        className={`whm-cell lv${cell.level ?? 0}`}
                        title={`${cell.day ?? ""}${cell.billable_total_tokens ? ` · ${formatTokensCompact(cell.billable_total_tokens)}` : ""}`}
                      />
                    ) : null,
                  )}
                </div>
              ))}
            </div>
            <div className="whm-foot">
              <span>{copy("widget.active_days")} <strong>{data.active_days ?? 0}</strong></span>
              <span>{copy("widget.total_cost")} <strong>${Number(data.total_cost_usd ?? 0).toFixed(2)}</strong></span>
            </div>
          </div>
        );
      }}
    </WidgetShell>
  );
}

const root = document.getElementById("widget-heatmap-root");
if (root) createRoot(root).render(<HeatmapWidget />);
