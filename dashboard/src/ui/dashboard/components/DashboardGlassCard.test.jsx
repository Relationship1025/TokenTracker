import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

const { DashboardGlassCard } = await import("./DashboardGlassCard.jsx");

it("marks a top-level dashboard card as glass only in neon-store", () => {
  const { rerender } = render(
    <DashboardGlassCard active>
      <div>usage</div>
    </DashboardGlassCard>,
  );
  expect(screen.getByText("usage").parentElement).toHaveAttribute("data-rainy-card", "true");

  rerender(
    <DashboardGlassCard active={false}>
      <div>usage</div>
    </DashboardGlassCard>,
  );
  expect(screen.getByText("usage").parentElement).not.toHaveAttribute("data-rainy-card");
});
