import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { BarChart3, Settings } from "lucide-react";
import { NavIconRail } from "./NavIconRail.jsx";

vi.mock("../../lib/copy", () => ({
  copy: (key) => ({ "nav.nav_label": "Primary navigation" }[key] || key),
}));

it("renders named icon links with active route semantics", () => {
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <NavIconRail
        pathname="/dashboard"
        groups={[
          {
            id: "general",
            items: [
              { id: "usage", to: "/dashboard", icon: BarChart3, label: "Usage" },
              { id: "settings", to: "/settings", icon: Settings, label: "Settings" },
            ],
          },
        ]}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: "Usage" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
});
