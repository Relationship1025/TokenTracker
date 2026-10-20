import React from "react";
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { DashboardGlassCard } from "./DashboardGlassCard.jsx";

function cardTree(active) {
  return (
    <DashboardGlassCard active={active}>
      <div data-testid="card-child" />
    </DashboardGlassCard>
  );
}

const RAINY_CARD_ATTRIBUTE = "data-rainy-card";

it("marks a top-level dashboard card as glass only in neon-store", () => {
  const { container, rerender } = render(cardTree(true));
  const activeCard = container.firstElementChild;
  expect(activeCard.getAttribute(RAINY_CARD_ATTRIBUTE)).toBe("true");
  rerender(cardTree(false));
  expect(container.firstElementChild.getAttribute(RAINY_CARD_ATTRIBUTE)).toBeNull();
});
