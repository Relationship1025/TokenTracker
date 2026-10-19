import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RainyDashboardLayout } from "./RainyDashboardLayout.jsx";

it("keeps the store beside two card streams", () => {
  render(
    <RainyDashboardLayout
      scene={<section aria-label="Rainy store" />}
      leftColumn={<section aria-label="Left cards">left</section>}
      rightColumn={<section aria-label="Right cards">right</section>}
    />,
  );
  expect(screen.getByLabelText("Rainy store")).toBeInTheDocument();
  expect(screen.getByLabelText("Left cards")).toBeInTheDocument();
  expect(screen.getByLabelText("Right cards")).toBeInTheDocument();
  expect(document.querySelector("[data-rainy-scene-pane]")).toBeInTheDocument();
  expect(document.querySelector("[data-rainy-card-pane]")).toBeInTheDocument();
});

it("renders the single narrow stream without live scene", () => {
  render(
    <RainyDashboardLayout
      narrow
      scene={<div data-testid="static-scene" />}
      leftColumn={<div>left</div>}
      rightColumn={<div>right</div>}
    />,
  );
  expect(screen.getByTestId("static-scene")).toBeInTheDocument();
  expect(screen.getByText("left")).toBeInTheDocument();
  expect(screen.getByText("right")).toBeInTheDocument();
  expect(document.querySelector("[data-rainy-layout='narrow']")).toBeInTheDocument();
});
