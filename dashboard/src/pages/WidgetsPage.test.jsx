import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy, setCopyLocale } from "../lib/copy";
import { EN_LOCALE, ZH_CN_LOCALE } from "../lib/locale";
import { WidgetsPage } from "./WidgetsPage.jsx";

/**
 * Fake the WebView2 host bridge (TokenTrackerWin). `?app=1` flips the sticky
 * native-app flag; `window.chrome.webview` is the Windows transport, which
 * receives a single JSON string per message (see native-bridge post()).
 */
function installWebView2Bridge(settings) {
  const messages = [];
  window.history.pushState({}, "", "/widgets?app=1");
  window.chrome = {
    webview: {
      postMessage(raw) {
        messages.push(JSON.parse(raw));
      },
    },
  };
  return {
    messages,
    pushSettings() {
      window.dispatchEvent(new CustomEvent("native:settings", { detail: settings }));
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WidgetsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  setCopyLocale(EN_LOCALE);
  window.history.pushState({}, "", "/");
  if (typeof window.localStorage?.removeItem === "function") {
    window.localStorage.removeItem("tokentracker_native_app");
  }
  delete window.chrome;
});

describe("WidgetsPage desktop quota widget", () => {
  it("reflects the pushed native state and toggles quotaWidget through the bridge", async () => {
    const user = userEvent.setup();
    const bridge = installWebView2Bridge({ platform: "windows", quotaWidget: true });

    renderPage();
    act(() => bridge.pushSettings());

    const toggle = await screen.findByRole("switch", { name: copy("widgets.quota.toggle.label") });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByAltText(copy("widgets.quota.screenshot.collapsed.aria"))).toBeInTheDocument();
    expect(screen.getByAltText(copy("widgets.quota.screenshot.expanded.aria"))).toBeInTheDocument();

    await act(async () => {
      await user.click(toggle);
    });

    await waitFor(() => {
      expect(bridge.messages).toContainEqual({
        type: "setSetting",
        key: "quotaWidget",
        value: false,
      });
    });
  });

  it("toggles the four gallery widgets through the bridge", async () => {
    const user = userEvent.setup();
    const bridge = installWebView2Bridge({
      platform: "windows",
      widgetSummary: true,
      widgetHeatmap: false,
      widgetTopmodels: false,
      widgetLimits: false,
    });

    renderPage();
    act(() => bridge.pushSettings());

    const summaryToggle = await screen.findByRole("switch", { name: copy("widgets.card.summary.toggle") });
    expect(summaryToggle).toHaveAttribute("aria-checked", "true");
    await act(async () => {
      await user.click(summaryToggle);
    });
    await waitFor(() => {
      expect(bridge.messages).toContainEqual({ type: "setSetting", key: "widgetSummary", value: false });
    });

    const heatmapToggle = screen.getByRole("switch", { name: copy("widgets.card.heatmap.toggle") });
    const topModelsToggle = screen.getByRole("switch", { name: copy("widgets.card.topmodels.toggle") });
    const limitsToggle = screen.getByRole("switch", { name: copy("widgets.card.limits.toggle") });
    await act(async () => {
      await user.click(heatmapToggle);
      await user.click(topModelsToggle);
      await user.click(limitsToggle);
    });
    expect(bridge.messages).toContainEqual({ type: "setSetting", key: "widgetHeatmap", value: true });
    expect(bridge.messages).toContainEqual({ type: "setSetting", key: "widgetTopmodels", value: true });
    expect(bridge.messages).toContainEqual({ type: "setSetting", key: "widgetLimits", value: true });
  });

  it("disables the toggle and shows the tray-app hint in plain browser mode", async () => {
    window.history.pushState({}, "", "/widgets");
    renderPage();

    const toggle = await screen.findByRole("switch", { name: copy("widgets.quota.toggle.label") });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(copy("widgets.quota.browser_hint"))).toBeInTheDocument();
  });

  it("localizes the quota widget card through copy", async () => {
    setCopyLocale(ZH_CN_LOCALE);
    const bridge = installWebView2Bridge({ platform: "windows", quotaWidget: false });

    renderPage();
    act(() => bridge.pushSettings());

    expect(screen.getByRole("heading", { name: copy("widgets.page.title") })).toBeInTheDocument();
    const toggle = await screen.findByRole("switch", { name: copy("widgets.quota.toggle.label") });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(copy("widgets.tray.title"))).toBeInTheDocument();
  });
});
