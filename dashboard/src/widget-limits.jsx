import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, Check, Settings2 } from "lucide-react";
import { copy } from "./lib/copy";
import {
  desktopQuotaRows,
  selectQuotaRows,
  quotaPeriodLabel,
  quotaResetCountdown,
} from "./lib/desktop-quota.js";
import { limitProviderName } from "./lib/limits-providers.js";
import { WidgetShell } from "./lib/widget-shell.jsx";

/* Context data is the raw usage-limits snapshot (same one the quota widget
 * renders); this surface shows up to 4 provider windows instead of 2. */

const MAX_ROWS = 4;

function remainingText(remaining) {
  return remaining !== 0 && Math.floor(remaining) === 0 ? "<1" : String(Math.round(remaining));
}

export function LimitsWidget() {
  const [choosing, setChoosing] = useState(false);
  return (
    <WidgetShell prefix="limits">
      {({ data, selected, locale, now, expanded, send }) => {
        const limits = data;
        const rows = desktopQuotaRows(limits);
        const compact = selectQuotaRows(rows, selected, MAX_ROWS);
        const label = row => quotaPeriodLabel(row, locale) || row.label || copy(row.labelKey);
        const resetText = row =>
          row.stale
            ? copy("quota.stale")
            : !Number.isFinite(row.resetMs)
              ? copy("quota.no_reset")
              : row.resetMs <= now
                ? copy("quota.awaiting")
                : copy("quota.reset_in", { time: quotaResetCountdown(row.resetMs, now, locale) });
        const pick = id => {
          const current = selected.length ? selected : compact.map(row => row.id);
          const next = current.includes(id)
            ? current.filter(item => item !== id)
            : [...current.slice(-(MAX_ROWS - 1)), id];
          send(JSON.stringify({ type: "limits:select", ids: next }));
        };

        if (!expanded && !compact.length) {
          return <div className="widget-empty">{copy(limits ? "quota.empty" : "widget.loading")}</div>;
        }

        if (expanded && choosing) {
          return (
            <div className="widget-body">
              {rows.map(row => (
                <button
                  className="wlim-choice"
                  key={row.id}
                  onClick={() => pick(row.id)}
                  aria-pressed={compact.some(item => item.id === row.id)}
                >
                  <span>
                    {limitProviderName(row.provider)}
                    <small>{label(row)}</small>
                  </span>
                  {compact.some(item => item.id === row.id) && <Check size={14} />}
                </button>
              ))}
              {!rows.length && <div className="widget-empty">{copy("quota.empty")}</div>}
              <div className="widget-empty" style={{ padding: "10px 0 0" }}>{copy("widget.limits_pick")}</div>
            </div>
          );
        }

        return (
          <>
            {expanded ? (
              <div className="widget-toolbar">
                <button
                  onClick={() => setChoosing(value => !value)}
                  aria-pressed={choosing}
                  aria-label={copy("quota.choose")}
                  title={copy("quota.choose")}
                >
                  <Settings2 size={13} />
                </button>
                <button onClick={() => send("limits:dashboard")} aria-label={copy("quota.dashboard")} title={copy("quota.dashboard")}>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            ) : null}
            <div className={`widget-body wlim ${expanded ? "wlim-expanded" : ""}`}>
              {compact.map(row => (
                <div className={`wlim-row ${row.remaining <= 10 ? "low" : ""}`} key={row.id}>
                  <div className="wlim-title">
                    <span>{limitProviderName(row.provider)}</span>
                    <span className="wlim-window">{label(row)}</span>
                  </div>
                  <div className="wlim-value">
                    <strong>{remainingText(row.remaining)}</strong>
                    <small>{copy("quota.percent")}</small>
                    <small>{resetText(row)}</small>
                  </div>
                  <div
                    className="wlim-track"
                    role="meter"
                    aria-label={`${limitProviderName(row.provider)} ${label(row)}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={row.remaining}
                  >
                    <span style={{ width: `${row.remaining}%` }} />
                  </div>
                </div>
              ))}
              {expanded && !compact.length && (
                <div className="widget-empty">{copy(rows.length ? "quota.unavailable" : "quota.empty")}</div>
              )}
            </div>
          </>
        );
      }}
    </WidgetShell>
  );
}

const root = document.getElementById("widget-limits-root");
if (root) createRoot(root).render(<LimitsWidget />);
