import React from "react";
import { Laptop, Loader2 } from "lucide-react";
import { Card } from "../../components";
import { copy } from "../../../lib/copy";
import { useDeviceUsage } from "../../../hooks/use-device-usage.ts";

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatTokens(value) {
  return new Intl.NumberFormat().format(Math.round(safeNumber(value)));
}

export function DeviceUsageCard({ from, to, timeZone, tzOffsetMinutes, deviceId = null, onDeviceSelect }) {
  const { devices, totals, loading, error } = useDeviceUsage({ from, to, timeZone, tzOffsetMinutes });
  const deviceRows = Array.isArray(devices) ? devices : [];
  const totalTokens = safeNumber(totals?.total_tokens);
  let body;

  if (loading) {
    body = (
      <div role="status" className="flex min-h-24 items-center justify-center gap-2 text-xs text-oai-gray-400 dark:text-oai-gray-500">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        {copy("dashboard.device_usage.loading")}
      </div>
    );
  } else if (error) {
    body = (
      <div role="alert" className="rounded-lg bg-oai-gray-50 px-3 py-3 text-xs text-oai-gray-500 dark:bg-oai-gray-800/50 dark:text-oai-gray-400">
        {copy("dashboard.device_usage.error")}
      </div>
    );
  } else if (deviceRows.length === 0) {
    body = (
      <div className="rounded-lg bg-oai-gray-50 px-3 py-3 text-xs text-oai-gray-500 dark:bg-oai-gray-800/50 dark:text-oai-gray-400">
        {copy("dashboard.device_usage.empty")}
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        {deviceRows.map((device, index) => {
          const tokens = safeNumber(device?.total_tokens);
          const percentage = totalTokens > 0 ? Math.min(100, Math.max(0, (tokens / totalTokens) * 100)) : 0;
          const roundedPercentage = Math.round(percentage);
          const id = String(device?.id || device?.name || `device-${index}`);
          const name = String(device?.name || id);
          const kind = device?.kind === "imported" ? "imported" : "local";
          const selected = String(deviceId || "") === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onDeviceSelect?.(id)}
              className={`block w-full space-y-1.5 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-oai-brand/60 ${selected ? "bg-oai-brand/5 px-2 py-1.5" : "px-0 py-0 hover:bg-oai-gray-50 dark:hover:bg-oai-gray-800/50"}`}
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex min-w-0 items-center gap-1.5 text-oai-gray-700 dark:text-oai-gray-200">
                  <Laptop aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-oai-gray-400" />
                  <span className="truncate font-medium">{name}</span>
                  <span className="shrink-0 rounded bg-oai-gray-100 px-1.5 py-0.5 text-[10px] text-oai-gray-500 dark:bg-oai-gray-800 dark:text-oai-gray-400">
                    {copy(`dashboard.device_usage.${kind}`)}
                  </span>
                </div>
                <span className="shrink-0 tabular-nums text-oai-gray-500 dark:text-oai-gray-400">{formatTokens(tokens)}</span>
              </div>
              <div
                role="progressbar"
                aria-label={copy("dashboard.device_usage.bar_aria", { name, percent: roundedPercentage })}
                aria-valuenow={roundedPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 overflow-hidden rounded-full bg-oai-gray-100 dark:bg-oai-gray-800"
              >
                <div className="h-full rounded-full bg-oai-brand transition-[width]" style={{ width: `${percentage}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Card title={copy("dashboard.device_usage.title")} subtitle={copy("dashboard.device_usage.subtitle")}>
      {body}
    </Card>
  );
}
