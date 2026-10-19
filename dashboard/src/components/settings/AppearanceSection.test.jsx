import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const setTheme = vi.fn();

vi.mock("../../hooks/useTheme.js", () => ({
  useTheme: () => ({ theme: "system", setTheme }),
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
});

it("offers and selects the rainy neon store theme", async () => {
  const user = userEvent.setup();
  render(<AppearanceSection />);
  await user.click(screen.getByRole("button", { name: "settings.appearance.theme.neon_store" }));
  expect(setTheme).toHaveBeenCalledWith("neon-store");
});
