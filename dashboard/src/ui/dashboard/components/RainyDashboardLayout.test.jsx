import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RainyDashboardLayout } from "./RainyDashboardLayout.jsx";

it("keeps the store above two card streams", () => {
  render(
    <RainyDashboardLayout
      scene={<section aria-label="Rainy store" />}
      leftColumn={<section aria-label="Left cards" />}
      rightColumn={<section aria-label="Right cards" />}
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
      leftColumn={<div data-testid="left-card" />}
      rightColumn={<div data-testid="right-card" />}
    />,
  );
  expect(screen.getByTestId("static-scene")).toBeInTheDocument();
  expect(screen.getByTestId("left-card")).toBeInTheDocument();
  expect(screen.getByTestId("right-card")).toBeInTheDocument();
  expect(document.querySelector("[data-rainy-layout='narrow']")).toBeInTheDocument();
});
