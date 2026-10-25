import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SummaryWidget } from "./widget-summary.jsx";
import { HeatmapWidget } from "./widget-heatmap.jsx";
import { TopModelsWidget } from "./widget-topmodels.jsx";
import { LimitsWidget } from "./widget-limits.jsx";

function installBridge() {
  let receive;
  const postMessage = vi.fn();
  window.chrome = {
    webview: {
      postMessage,
      addEventListener: (_, callback) => { receive = callback; },
      removeEventListener: vi.fn(),
    },
  };
  return {
    postMessage,
    push(type, payload) {
      act(() => receive({ data: { type, locale: "en", light: false, ...payload } }));
    },
  };
}

afterEach(() => { delete window.chrome; });

describe("native widget pages", () => {
  it("summary renders today and 7-day metrics from the pushed context", () => {
    const bridge = installBridge();
    render(<SummaryWidget />);
    expect(bridge.postMessage).toHaveBeenCalledWith("summary:ready");
    bridge.push("summary:context", {
      data: {
        today: { tokens: 203_200_000, cost: "129.56", conversations: 42 },
        last7d: { tokens: 880_900_000, activeDays: 6 },
      },
    });
    expect(screen.getByText("203.2M")).toBeInTheDocument();
    expect(screen.getByText("880.9M")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(bridge.postMessage).toHaveBeenCalledWith("summary:collapse");
  });

  it("heatmap renders the week grid and footer totals", () => {
    const bridge = installBridge();
    render(<HeatmapWidget />);
    bridge.push("heatmap:context", {
      data: {
        weeks: [
          [
            { day: "2026-10-19", billable_total_tokens: 120, level: 1 },
            { day: "2026-10-20", billable_total_tokens: 900, level: 4 },
            { day: "2026-10-21", billable_total_tokens: 0, level: 0 },
          ],
        ],
        active_days: 202,
        total_cost_usd: 1030.5,
      },
    });
    expect(screen.getAllByTitle("2026-10-20 · 900")).toHaveLength(1);
    expect(screen.getByText("202")).toBeInTheDocument();
    expect(screen.getByText("$1030.50")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close widget" }));
    expect(bridge.postMessage).toHaveBeenCalledWith("heatmap:close");
  });

  it("top models renders ranked rows with share bars", () => {
    const bridge = installBridge();
    render(<TopModelsWidget />);
    bridge.push("topmodels:context", {
      data: {
        models: [
          { name: "claude-opus-4-6", percent: "58.6", source: "claude" },
          { name: "gpt-5.4", percent: "8.1", source: "codex" },
        ],
      },
    });
    expect(screen.getByText("claude-opus-4-6")).toBeInTheDocument();
    expect(screen.getByText("58.6%")).toBeInTheDocument();
    expect(screen.getByText("8.1%")).toBeInTheDocument();
  });

  it("limits renders provider rows and sends selection messages", () => {
    const bridge = installBridge();
    render(<LimitsWidget />);
    bridge.push("limits:context", {
      selected: [],
      data: {
        codex: { configured: true, primary_window: { used_percent: 25 }, secondary_window: { used_percent: 40 } },
        claude: { configured: true, seven_day: { utilization: 61 } },
      },
    });
    // Remaining = 100 - used.
    expect(screen.getByText("75")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand limits" }));
    expect(bridge.postMessage).toHaveBeenCalledWith("limits:expand");
    // Expanded: open the chooser and toggle a provider window.
    fireEvent.click(screen.getByRole("button", { name: "Choose limits" }));
    fireEvent.click(screen.getAllByRole("button", { pressed: false })[0]);
    expect(
      bridge.postMessage.mock.calls.some(([message]) =>
        typeof message === "string" && message.includes('"limits:select"')),
    ).toBe(true);
  });

  it("applies the neon-store day and night styles from the context", () => {
    const bridge = installBridge();
    render(<SummaryWidget />);
    const main = () => document.querySelector("main.widget");

    bridge.push("summary:context", {
      style: "store-night",
      data: { today: { tokens: 1, cost: 0 }, last7d: { tokens: 2, activeDays: 1 } },
    });
    expect(main().className).toContain("store-night");
    expect(main().className).toContain("store");

    bridge.push("summary:context", {
      style: "store-day",
      light: true,
      data: { today: { tokens: 1, cost: 0 }, last7d: { tokens: 2, activeDays: 1 } },
    });
    expect(main().className).toContain("store-day");
    expect(main().className).not.toContain("light");
  });

  it("falls back to the light flag when no style is pushed (older hosts)", () => {
    const bridge = installBridge();
    render(<SummaryWidget />);
    bridge.push("summary:context", {
      light: true,
      data: { today: { tokens: 1, cost: 0 }, last7d: { tokens: 2, activeDays: 1 } },
    });
    expect(document.querySelector("main.widget").className).toContain("light");
  });
});
