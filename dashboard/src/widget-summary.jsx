import React from "react";
import { createRoot } from "react-dom/client";
import { copy } from "./lib/copy";
import { formatTokensCompact } from "./lib/format-tokens.js";
import { WidgetShell } from "./lib/widget-shell.jsx";

/* Context data (from UsagePoller.UsageStats, serialized by the tray host):
 * { today:{tokens,cost,conversations}, last7d:{tokens,activeDays},
 *   last30d:{tokens,avgPerDay}, streakDays, activeDaysAllTime } */

function Metric({ label, tokens, cost, sub }) {
  return (
    <div className="wsum-metric">
      <span className="wsum-label">{label}</span>
      <span className="wsum-value">
        <strong>{formatTokensCompact(tokens ?? 0)}</strong>
        {cost != null && <small>${Number(cost).toFixed(2)}</small>}
      </span>
      {sub ? <span className="wsum-sub">{sub}</span> : null}
    </div>
  );
}

export function SummaryWidget() {
  return (
    <WidgetShell prefix="summary">
      {({ data, expanded }) => {
        if (!data?.today) {
          return <div className="widget-empty">{copy("widget.loading")}</div>;
        }
        const chips = expanded
          ? [
              { key: "widget.conversations", value: data.today.conversations },
              { key: "widget.streak_days", value: data.streakDays },
              { key: "widget.active_days", value: data.activeDaysAllTime },
            ].filter(chip => Number.isFinite(chip.value) && chip.value > 0)
          : [];        return (
          <div className={`widget-body wsum ${expanded ? "wsum-expanded" : ""}`}>
            <div className="wsum-row">
              <Metric label={copy("widget.today")} tokens={data.today.tokens} cost={data.today.cost} />
              <Metric
                label={copy("widget.seven_days")}
                tokens={data.last7d?.tokens}
                sub={copy("widget.active_days_count", { count: data.last7d?.activeDays ?? 0 })}
              />
            </div>
            {expanded ? (
              <>
                <div className="wsum-row">
                  <Metric label={copy("widget.thirty_days")} tokens={data.last30d?.tokens} />
                  <Metric
                    label={copy("widget.avg_per_day")}
                    tokens={data.last30d?.avgPerDay}
                    sub={copy("widget.last30d_active")}
                  />
                </div>
                {chips.length ? (
                  <div className="wsum-chips">
                    {chips.map(chip => (
                      <span className="wsum-chip" key={chip.key}>
                        {copy(chip.key)} <strong>{chip.value}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        );
      }}
    </WidgetShell>
  );
}

const root = document.getElementById("widget-summary-root");
if (root) createRoot(root).render(<SummaryWidget />);
