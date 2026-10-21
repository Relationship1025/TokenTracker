import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { RainyDashboardLayout } from "./RainyDashboardLayout.jsx";

it("keeps the store above a collapsible card dock", () => {
  render(
    <RainyDashboardLayout
      scene={<section aria-label="Rainy store" />}
      leftColumn={<section aria-label="Left cards" />}
      rightColumn={<section aria-label="Right cards" />}
      dockTitles={[
        { id: "statsPanel", label: "Identity" },
        { id: "usageOverview", label: "Usage" },
      ]}
      defaultExpanded
    />,
  );
  expect(screen.getByLabelText("Rainy store")).toBeInTheDocument();
  expect(screen.getByLabelText("Left cards")).toBeInTheDocument();
  expect(screen.getByLabelText("Right cards")).toBeInTheDocument();
  expect(document.querySelector("[data-rainy-scene-pane]")).toBeInTheDocument();
  expect(document.querySelector("[data-rainy-card-pane]")).toBeInTheDocument();
  expect(document.querySelector('[data-rainy-dock="open"]')).toBeInTheDocument();
});

it("starts collapsed with title chips and expands via the handle", () => {
  render(
    <RainyDashboardLayout
      scene={<section aria-label="Rainy store" />}
      leftColumn={<section aria-label="Left cards" />}
      rightColumn={<section aria-label="Right cards" />}
      dockTitles={[
        { id: "statsPanel", label: "Identity" },
        { id: "usageOverview", label: "Usage" },
      ]}
    />,
  );
  expect(document.querySelector('[data-rainy-dock="closed"]')).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Identity" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Left cards")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Expand cards" }));
  expect(document.querySelector('[data-rainy-dock="open"]')).toBeInTheDocument();
  expect(screen.getByLabelText("Left cards")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Collapse cards" }));
  expect(document.querySelector('[data-rainy-dock="closed"]')).toBeInTheDocument();
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
