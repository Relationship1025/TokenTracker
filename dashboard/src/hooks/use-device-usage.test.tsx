import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeviceUsage } from "../lib/api";
import { useDeviceUsage } from "./use-device-usage";

const originalFetch = globalThis.fetch;
const originalLocation = window.location;

function setHostname(hostname: string) {
  Object.defineProperty(window, "location", {
    value: { ...window.location, hostname, origin: `http://${hostname}` },
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
  Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
});

describe("getDeviceUsage", () => {
  it("sends the range and timezone query parameters to the local endpoint", async () => {
    setHostname("localhost");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ devices: [], totals: {} }), { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await getDeviceUsage({ from: "2026-10-01", to: "2026-10-07", timeZone: "America/New_York", tzOffsetMinutes: -240 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/functions/tokentracker-local-device-usage"),
      expect.objectContaining({ cache: "no-store" }),
    );
    const requestUrl = new URL((fetchMock.mock.calls as unknown as Array<[string]>)[0]?.[0] || "");
    expect(requestUrl.searchParams.get("from")).toBe("2026-10-01");
    expect(requestUrl.searchParams.get("to")).toBe("2026-10-07");
    expect(requestUrl.searchParams.get("tz")).toBe("America/New_York");
    expect(requestUrl.searchParams.get("tz_offset_minutes")).toBe("-240");
  });

  it("rejects on non-localhost hosts before making a request", async () => {
    setHostname("www.example.com");
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(getDeviceUsage({ from: "2026-10-01", to: "2026-10-07" })).rejects.toMatchObject({ code: "LOCAL_API_UNAVAILABLE", status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useDeviceUsage", () => {
  it("loads normalized devices and totals", async () => {
    setHostname("localhost");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ devices: [{ id: "a" }], totals: { total_tokens: 4 } }), { status: 200 }));

    const { result } = renderHook(() => useDeviceUsage({ from: "2026-10-01", to: "2026-10-07", timeZone: "UTC", tzOffsetMinutes: 0 }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.devices).toEqual([{ id: "a" }]);
    expect(result.current.totals).toEqual({ total_tokens: 4 });
    expect(result.current.error).toBeNull();
  });

  it("reports errors and safely defaults missing arrays and totals", async () => {
    setHostname("localhost");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useDeviceUsage({ from: "2026-10-01", to: "2026-10-07" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.devices).toEqual([]);
    expect(result.current.totals).toEqual({});
    expect(result.current.error).toBe("offline");
  });

  it("reloads when the range changes and ignores a stale response", async () => {
    setHostname("localhost");
    let resolveOld: (value: Response) => void = () => {};
    const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve; });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(oldResponse)
      .mockResolvedValueOnce(new Response(JSON.stringify({ devices: [{ id: "new" }], totals: { total_tokens: 2 } }), { status: 200 }));
    const { result, rerender } = renderHook(({ from }) => useDeviceUsage({ from, to: "2026-10-07" }), { initialProps: { from: "2026-10-01" } });
    rerender({ from: "2026-10-02" });
    await waitFor(() => expect(result.current.devices).toEqual([{ id: "new" }]));
    await act(async () => { resolveOld(new Response(JSON.stringify({ devices: [{ id: "old" }], totals: { total_tokens: 1 } }), { status: 200 })); });
    expect(result.current.devices).toEqual([{ id: "new" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exposes refresh to fetch the current selection again", async () => {
    setHostname("localhost");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ devices: [{ id: "first" }], totals: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ devices: [{ id: "second" }], totals: {} }), { status: 200 }));
    const { result } = renderHook(() => useDeviceUsage({ from: "2026-10-01", to: "2026-10-07" }));
    await waitFor(() => expect(result.current.devices).toEqual([{ id: "first" }]));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.devices).toEqual([{ id: "second" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
