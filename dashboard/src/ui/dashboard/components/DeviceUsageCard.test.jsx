import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCopyLocale } from "../../../lib/copy";
import { EN_LOCALE } from "../../../lib/locale";
import { DeviceUsageCard } from "./DeviceUsageCard.jsx";

const usage = vi.hoisted(() => ({ loading: true, error: null, devices: [], totals: {} }));

vi.mock("../../../hooks/use-device-usage.ts", () => ({
  useDeviceUsage: () => usage,
}));

describe("DeviceUsageCard", () => {
  beforeEach(() => {
    setCopyLocale(EN_LOCALE);
    usage.loading = true;
    usage.error = null;
    usage.devices = [];
    usage.totals = {};
  });

  it("shows a loading status", () => {
    render(<DeviceUsageCard from="2026-10-01" to="2026-10-07" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading device usage");
  });

  it("renders local and imported rows with proportional accessible bars", () => {
    usage.loading = false;
    usage.devices = [
      { id: "local-1", name: "MacBook", kind: "local", total_tokens: 75 },
      { id: "remote-1", name: "Work PC", kind: "imported", total_tokens: 25 },
    ];
    usage.totals = { total_tokens: 100 };
    render(<DeviceUsageCard from="2026-10-01" to="2026-10-07" />);
    expect(screen.getByText("MacBook")).toBeInTheDocument();
    expect(screen.getByText("Work PC")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "MacBook: 75%" })).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByRole("progressbar", { name: "MacBook: 75%" }).firstElementChild).toHaveStyle({ width: "75%" });
  });

  it("reports the clicked device so the dashboard can filter usage", () => {
    usage.loading = false;
    usage.devices = [
      { id: "local-1", name: "MacBook", kind: "local", total_tokens: 75 },
    ];
    usage.totals = { total_tokens: 75 };
    const onDeviceSelect = vi.fn();
    render(<DeviceUsageCard from="2026-10-01" to="2026-10-07" onDeviceSelect={onDeviceSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /MacBook/ }));

    expect(onDeviceSelect).toHaveBeenCalledWith("local-1");
  });

  it("marks the active device row as pressed", () => {
    usage.loading = false;
    usage.devices = [
      { id: "local-1", name: "MacBook", kind: "local", total_tokens: 75 },
    ];
    usage.totals = { total_tokens: 75 };
    render(<DeviceUsageCard from="2026-10-01" to="2026-10-07" deviceId="local-1" />);

    expect(screen.getByRole("button", { name: /MacBook/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an empty range message", () => {
    usage.loading = false;
    render(<DeviceUsageCard from="2026-10-01" to="2026-10-07" />);
    expect(screen.getByText("No device usage in this range")).toBeInTheDocument();
  });

  it("shows an error fallback without throwing", () => {
    usage.loading = false;
    usage.error = "offline";
    render(<DeviceUsageCard from="2026-10-01" to="2026-10-07" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Device usage is unavailable");
  });
});
