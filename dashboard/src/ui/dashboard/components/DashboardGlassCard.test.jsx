import React from "react";
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { DashboardGlassCard } from "./DashboardGlassCard.jsx";

function cardTree(active, child = <div data-testid="card-child" />) {
  return (
    <DashboardGlassCard active={active}>
      {child}
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

it("renders nothing when the wrapped card returned null so empty glass shells cannot leak borders", () => {
  const { container, rerender } = render(cardTree(true, null));
  expect(container.firstElementChild).toBeNull();
  rerender(cardTree(false, null));
  expect(container.firstElementChild).toBeNull();
  rerender(cardTree(true, false));
  expect(container.firstElementChild).toBeNull();
});
