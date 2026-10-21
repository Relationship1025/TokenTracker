import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./Sidebar.jsx";

const LABELS = {
  "nav.group.general": "General",
  "nav.group.tools": "Tools",
  "nav.group.account": "Account",
  "nav.usage": "Usage",
  "nav.sessions": "Sessions",
  "nav.limits": "Limits",
  "nav.widgets": "Widgets",
  "nav.pet": "Desktop pet",
  "nav.skills": "Skills",
  "nav.ip_check": "IP check",
  "nav.service_status": "Service status",
  "settings.section.transfer": "Data transfer",
  "nav.settings": "Settings",
  "nav.expand": "Expand sidebar",
  "nav.collapse": "Collapse sidebar",
  "nav.menu": "Open navigation menu",
  "nav.close_menu": "Close navigation menu",
  "nav.aside_label": "Main navigation",
  "nav.nav_label": "Primary navigation",
  "shared.app_name": "Token Tracker",
  "settings.appearance.theme.label": "Theme",
  "settings.appearance.theme.light": "Light",
  "settings.appearance.theme.dark": "Dark",
  "settings.appearance.theme.system": "System",
  "settings.appearance.theme.neon_store": "Rainy Neon Store",
  "shared.github.star": "Star",
};

const themeState = vi.hoisted(() => ({
  theme: "system",
  resolvedTheme: "light",
  isNeonStore: false,
}));

vi.mock("../../lib/copy", () => ({
  copy: (key, params) => {
    const value = LABELS[key] || key;
    if (!params) return value;
    return Object.entries(params).reduce(
      (text, [name, replacement]) => text.split(`{{${name}}}`).join(String(replacement)),
      value,
    );
  },
}));

vi.mock("../../hooks/useTheme.js", () => ({
  useTheme: () => ({ ...themeState, setTheme: vi.fn() }),
}));

vi.mock("../../hooks/useLocale.js", () => ({
  useLocale: () => ({ resolvedLocale: "en" }),
}));

vi.mock("../../lib/native-bridge.js", () => ({
  isNativeApp: () => false,
  isNativeEmbed: () => false,
  isNativeWindowsApp: () => false,
  isNativeLinuxApp: () => false,
}));

let localDashboardHost = true;

vi.mock("../../lib/host-mode", () => ({
  isLocalDashboardHost: () => localDashboardHost,
}));

vi.mock("../dashboard/util/should-fetch-github-stars.js", () => ({
  shouldFetchGithubStars: () => false,
}));

let desktopMatches = false;
let mediaListeners;

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <AppLayout>
        <main />
      </AppLayout>
    </MemoryRouter>,
  );
}

describe("AppLayout sidebar controls", () => {
  beforeEach(() => {
    window.localStorage.clear();
    localDashboardHost = true;
    desktopMatches = false;
    mediaListeners = new Set();
    themeState.theme = "system";
    themeState.resolvedTheme = "light";
    themeState.isNeonStore = false;
    window.matchMedia = vi.fn((query) => ({
      matches: query === "(min-width: 1024px)" ? desktopMatches : false,
      media: query,
      onchange: null,
      addEventListener: (_type, listener) => mediaListeners.add(listener),
      removeEventListener: (_type, listener) => mediaListeners.delete(listener),
      addListener: (_listener) => {},
      removeListener: (_listener) => {},
      dispatchEvent: vi.fn(),
    }));
  });

  it("uses a fixed icon rail in the rainy neon store theme", () => {
    themeState.theme = "neon-store";
    themeState.resolvedTheme = "dark";
    themeState.isNeonStore = true;
    renderLayout();

    const sidebar = screen.getByRole("complementary", { name: "Main navigation" });
    expect(sidebar).toHaveAttribute("data-sidebar-state", "rail");
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usage" })).toBeInTheDocument();
    expect(document.querySelector("[data-rainy-nav-rail]")).toBeInTheDocument();
    expect(document.querySelector(".tt-rainy-rail-stack")).toBeInTheDocument();
    expect(document.querySelectorAll(".tt-rainy-rail-chip").length).toBeGreaterThan(1);
    expect(document.querySelector(".tt-rainy-rail-brand")).not.toBeInTheDocument();
    expect(document.querySelector(".tt-rainy-rail-utilities")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    // Settings remains reachable from the icon rail, not a duplicated footer control.
    const settingsLinks = screen.getAllByRole("link", { name: "Settings" });
    expect(settingsLinks).toHaveLength(1);
  });

  it("collapses and expands the desktop sidebar and persists the preference", async () => {
    const user = userEvent.setup();
    renderLayout();

    const sidebar = screen.getByRole("complementary", { name: "Main navigation" });
    const collapseButton = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(sidebar).toHaveAttribute("data-sidebar-state", "expanded");
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");

    await act(async () => user.click(collapseButton));

    expect(sidebar).toHaveAttribute("data-sidebar-state", "collapsed");
    expect(window.localStorage.getItem("tt.sidebarCollapsed")).toBe("1");
    expect(screen.getByRole("link", { name: "Usage" })).toHaveAttribute("aria-label", "Usage");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");

    await act(async () => user.click(screen.getByRole("button", { name: "Expand sidebar" })));

    expect(sidebar).toHaveAttribute("data-sidebar-state", "expanded");
    expect(window.localStorage.getItem("tt.sidebarCollapsed")).toBe("0");
  });

  it("shows data transfer in the tools directory for local dashboards", () => {
    renderLayout();

    expect(screen.getByRole("link", { name: "Data transfer" })).toHaveAttribute("href", "/data-transfer");
  });

  it("hides data transfer outside the local dashboard host", () => {
    localDashboardHost = false;
    renderLayout();

    expect(screen.queryByRole("link", { name: "Data transfer" })).not.toBeInTheDocument();
  });

  it("moves focus into the mobile drawer and closes it with the dedicated button", async () => {
    const user = userEvent.setup();
    renderLayout();

    const openButton = screen.getByRole("button", { name: "Open navigation menu" });
    await act(async () => user.click(openButton));

    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    const closeButton = screen.getByRole("button", { name: "Close navigation menu" });
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(closeButton);

    await act(async () => user.click(closeButton));

    expect(screen.queryByRole("dialog", { name: "Main navigation" })).not.toBeInTheDocument();
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(openButton);
  });

  it("closes the mobile drawer with Escape and backdrop clicks", async () => {
    const user = userEvent.setup();
    renderLayout();
    const openButton = screen.getByRole("button", { name: "Open navigation menu" });

    await act(async () => user.click(openButton));
    await act(async () => user.keyboard("{Escape}"));
    expect(screen.queryByRole("dialog", { name: "Main navigation" })).not.toBeInTheDocument();

    await act(async () => user.click(openButton));
    const backdrop = document.querySelector(".bg-black\\/40");
    expect(backdrop).toBeInTheDocument();
    await act(async () => user.click(backdrop));
    expect(screen.queryByRole("dialog", { name: "Main navigation" })).not.toBeInTheDocument();
  });

  it("keeps Tab focus within the mobile drawer", async () => {
    const user = userEvent.setup();
    renderLayout();
    await act(async () => user.click(screen.getByRole("button", { name: "Open navigation menu" })));

    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    const focusable = drawer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    await act(async () => user.tab());
    expect(document.activeElement).toBe(first);

    first.focus();
    await act(async () => user.tab({ shift: true }));
    expect(document.activeElement).toBe(last);
  });

  it("closes an open drawer when the viewport crosses the desktop breakpoint", async () => {
    const user = userEvent.setup();
    renderLayout();
    const openButton = screen.getByRole("button", { name: "Open navigation menu" });
    const mainContent = document.getElementById("app-main-content");
    await act(async () => user.click(openButton));
    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      desktopMatches = true;
      mediaListeners.forEach((listener) => listener({ matches: true }));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    expect(screen.queryByRole("dialog", { name: "Main navigation" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(mainContent);
    expect(document.activeElement).not.toBe(openButton);
  });
});
