import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const setTheme = vi.fn();
const setNeonStorePeriod = vi.fn();
const themeState = vi.hoisted(() => ({
  theme: "light",
  resolvedTheme: "light",
  neonStorePeriod: "night",
}));

vi.mock("../../hooks/useTheme.js", () => ({
  useTheme: () => ({
    theme: themeState.theme,
    setTheme,
    resolvedTheme: themeState.resolvedTheme,
    neonStorePeriod: themeState.neonStorePeriod,
    setNeonStorePeriod,
  }),
}));
vi.mock("../../hooks/useLocale.js", () => ({
  useLocale: () => ({ locale: "system", setLocale: vi.fn() }),
}));
vi.mock("../../hooks/useCurrency.js", () => ({
  useCurrency: () => ({
    currency: "USD",
    rate: 1,
    rateSource: "static",
    rateFetchedAt: null,
    setCurrency: vi.fn(),
  }),
}));
vi.mock("../../hooks/useTokenFormat.js", () => ({
  useTokenFormat: () => ({
    mode: "compact",
    setMode: vi.fn(),
    unitSystem: "english",
    setUnitSystem: vi.fn(),
    grouping: "standard",
    setGrouping: vi.fn(),
  }),
}));
vi.mock("../../lib/copy", () => ({ copy: (key) => key }));
vi.mock("../../ui/components", () => ({
  Select: ({ ariaLabel }) => <button aria-label={ariaLabel} />,
}));
vi.mock("./Controls.jsx", () => ({
  SectionCard: ({ children }) => <section>{children}</section>,
  SettingsRow: ({ control }) => <div>{control}</div>,
  SegmentedControl: ({ options, onChange }) => (
    <div>
      {options.map((option) => (
        <button key={option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

const { AppearanceSection } = await import("./AppearanceSection.jsx");

beforeEach(() => {
  setTheme.mockClear();
  setNeonStorePeriod.mockClear();
  themeState.theme = "light";
  themeState.resolvedTheme = "light";
  themeState.neonStorePeriod = "night";
});

it("offers and selects the rainy neon store theme", async () => {
  const user = userEvent.setup();
  render(<AppearanceSection />);
  await user.click(screen.getByRole("button", { name: "settings.appearance.theme.neon_store" }));
  expect(setTheme).toHaveBeenCalledWith("neon-store");
});

it("hides store day/night controls in classic theme", () => {
  render(<AppearanceSection />);
  expect(screen.queryByRole("button", { name: "dashboard.rainy_store.period_day" })).not.toBeInTheDocument();
});

it("shows and updates store day/night when neon-store is active", async () => {
  themeState.theme = "neon-store";
  themeState.resolvedTheme = "dark";
  const user = userEvent.setup();
  render(<AppearanceSection />);
  expect(screen.getByRole("button", { name: "dashboard.rainy_store.period_day" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "dashboard.rainy_store.period_day" }));
  expect(setNeonStorePeriod).toHaveBeenCalledWith("day");
});
