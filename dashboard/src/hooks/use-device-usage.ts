import { useCallback, useEffect, useState } from "react";
import { getDeviceUsage } from "../lib/api";
import { useLatestRequestGuard } from "./use-latest-request-guard";

export function useDeviceUsage({ from, to, timeZone, tzOffsetMinutes }: any = {}) {
  const [devices, setDevices] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const beginRequest = useLatestRequestGuard([from, to, timeZone, tzOffsetMinutes]);

  const load = useCallback(() => {
    const isCurrent = beginRequest();
    setLoading(true);
    setError(null);
    return getDeviceUsage({ from, to, timeZone, tzOffsetMinutes })
      .then((response: any) => {
        const nextDevices = Array.isArray(response?.devices) ? response.devices : [];
        const nextTotals = response?.totals && typeof response.totals === "object" && !Array.isArray(response.totals)
          ? response.totals
          : {};
        if (isCurrent()) {
          setDevices(nextDevices);
          setTotals(nextTotals);
        }
        return { devices: nextDevices, totals: nextTotals };
      })
      .catch((err: any) => {
        if (isCurrent()) {
          setDevices([]);
          setTotals({});
          setError(err?.message || String(err));
        }
        return null;
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
  }, [beginRequest, from, to, timeZone, tzOffsetMinutes]);

  useEffect(() => {
    void load();
  }, [load]);

  return { devices, totals, loading, error, refresh: load };
}
