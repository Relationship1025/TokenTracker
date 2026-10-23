import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { copy } from "../../../lib/copy";
import { LEFT_CARD_ORDER_DEFAULTS } from "../../../pages/DashboardPage.jsx";
import { DashboardView } from "./DashboardView.jsx";

const loadingCard = vi.hoisted(() => ({ pending: true, mounts: 0, unmounts: 0 }));
const deviceUsageCard = vi.hoisted(() => ({ calls: [] }));
const themeState = vi.hoisted(() => ({ isNeonStore: false }));

vi.mock("../../../hooks/useTheme.js", () => ({
  useTheme: () => ({ theme: themeState.isNeonStore ? "neon-store" : "dark", isNeonStore: themeState.isNeonStore, neonStorePeriod: "night", setNeonStorePeriod: () => {} }),
}));

vi.mock("../../components", () => ({ Shell: ({ children }) => <>{children}</>, Card: ({ children }) => <>{children}</> }));
vi.mock("../../foundation/FadeIn.jsx", () => ({ FadeIn: ({ children }) => <>{children}</> }));
vi.mock("../components/StatsPanel.jsx", () => ({ StatsPanel: () => <section data-testid="stats" /> }));
vi.mock("../components/UsageOverview.jsx", () => ({ UsageOverview: () => <section data-testid="usage" /> }));
vi.mock("../components/DeviceUsageCard.jsx", () => ({ DeviceUsageCard: (props) => {
  deviceUsageCard.calls.push(props);
  return <section data-testid="device-usage" />;
} }));
vi.mock("../components/CostAnalysisModal.jsx", () => ({ CostAnalysisModal: () => null }));
vi.mock("../components/QualityPerDollarCard.jsx", async () => {
  const { useEffect } = await import("react");
  return { QualityPerDollarCard: function Card() {
    useEffect(() => {
      loadingCard.mounts++;
      return () => { loadingCard.unmounts++; };
    }, []);
    if (loadingCard.pending) return null;
    return <section data-testid="quality" />;
  } };
});

afterEach(() => {
  cleanup();
  themeState.isNeonStore = false;
});

it("registers device usage in the default left-column order", () => {
  expect(LEFT_CARD_ORDER_DEFAULTS).toContain("deviceUsage");
});

it("renders device usage and propagates the active range and timezone", () => {
  deviceUsageCard.calls = [];
  render(<DashboardView copy={copy} isLocalMode
    leftCardOrder={["deviceUsage"]} rightCardOrder={["usageOverview"]}
    usageFrom="2026-10-01" usageTo="2026-10-07"
    timeZone="America/New_York" tzOffsetMinutes={-240} />);
  expect(screen.getByTestId("device-usage")).toBeInTheDocument();
  expect(deviceUsageCard.calls[0]).toMatchObject({
    from: "2026-10-01",
    to: "2026-10-07",
    timeZone: "America/New_York",
    tzOffsetMinutes: -240,
  });
});

it("passes the active device filter and selection callback to device usage", () => {
  const onDeviceSelect = vi.fn();
  deviceUsageCard.calls = [];
  render(<DashboardView copy={copy} isLocalMode
    leftCardOrder={["deviceUsage"]} rightCardOrder={["usageOverview"]}
    deviceId="local-1" onDeviceSelect={onDeviceSelect} />);

  expect(deviceUsageCard.calls[0]).toMatchObject({
    deviceId: "local-1",
    onDeviceSelect,
  });
});

it("ignores removed promotional cards in saved layouts without leaving draggable empty slots", () => {
  render(<DashboardView copy={copy} isLocalMode
    leftCardOrder={["islandOnboarding", "linuxPetCard", "macAppBanner", "widgetOnboarding", "linuxTopBarCard", "statsPanel"]}
    rightCardOrder={["usageOverview"]} />);
  expect(screen.getByTestId("stats")).toBeInTheDocument();
  expect(screen.getByTestId("usage")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: copy("dashboard.overview.layout.drag_handle") })).toHaveLength(2);
});

it("keeps every card draggable while adding rainy glass wrappers", () => {
  themeState.isNeonStore = true;
  render(
    <DashboardView
      copy={copy}
      isLocalMode
      leftCardOrder={["statsPanel"]}
      rightCardOrder={["usageOverview"]}
    />,
  );
  expect(screen.getByTestId("stats")).toBeInTheDocument();
  expect(screen.getByTestId("usage")).toBeInTheDocument();
  expect(document.querySelectorAll("[data-rainy-card='true']")).toHaveLength(2);
  // Dock starts collapsed (grid display:none); expand so drag handles are exposed to role queries.
  fireEvent.click(screen.getByRole("button", { name: "Expand cards" }));
  expect(screen.getAllByRole("button", { name: copy("dashboard.overview.layout.drag_handle") })).toHaveLength(2);
});

it("keeps an async data card mounted while empty so its loaded result can appear", () => {
  loadingCard.pending = true;
  loadingCard.mounts = loadingCard.unmounts = 0;
  const page = () => <DashboardView copy={copy} isLocalMode
    leftCardOrder={["qualityPerDollar"]} rightCardOrder={["usageOverview"]} />;
  const view = render(page());
  expect(screen.queryByTestId("quality")).toBeNull();
  expect(loadingCard.mounts).toBe(1);
  expect(loadingCard.unmounts).toBe(0);
  loadingCard.pending = false;
  view.rerender(page());
  expect(screen.getByTestId("quality")).toBeInTheDocument();
  expect(loadingCard.mounts).toBe(1);
  expect(loadingCard.unmounts).toBe(0);
});

it("omits empty cards from rainy dock title chips while keeping them mounted", async () => {
  themeState.isNeonStore = true;
  loadingCard.pending = true;
  loadingCard.mounts = loadingCard.unmounts = 0;
  render(
    <DashboardView
      copy={copy}
      isLocalMode
      leftCardOrder={["statsPanel", "qualityPerDollar"]}
      rightCardOrder={["usageOverview"]}
    />,
  );
  // SortableCard reports emptiness in useLayoutEffect → dock chips update on next paint.
  await waitFor(() => {
    expect(screen.queryByRole("button", { name: copy("qpd.card.title") })).toBeNull();
  });
  expect(screen.getByRole("button", { name: copy("dashboard.identity.title") })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: copy("nav.usage") })).toBeInTheDocument();
  expect(loadingCard.mounts).toBe(1);
  expect(loadingCard.unmounts).toBe(0);
});
