import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { RainyDashboardLayout, useRainyDockOverlay } from "./RainyDashboardLayout.jsx";

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
  // Cards stay mounted (display:none) so empty-card reporting can filter chips.
  expect(screen.getByLabelText("Left cards")).toBeInTheDocument();
  expect(document.querySelector(".tt-rainy-card-grid--dock-collapsed")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Expand cards" }));
  expect(document.querySelector('[data-rainy-dock="open"]')).toBeInTheDocument();
  expect(screen.getByLabelText("Left cards")).toBeInTheDocument();
  expect(document.querySelector(".tt-rainy-card-grid--dock-collapsed")).toBeNull();

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

it("collapses the dock for an overlay and restores the prior expanded state", () => {
  let api;
  function Probe() {
    api = useRainyDockOverlay();
    return <section aria-label="Probe card" />;
  }
  render(
    <RainyDashboardLayout
      scene={<section aria-label="Rainy store" />}
      leftColumn={<Probe />}
      rightColumn={<section aria-label="Right cards" />}
      dockTitles={[{ id: "statsPanel", label: "Identity" }]}
      defaultExpanded
    />,
  );
  expect(document.querySelector('[data-rainy-dock="open"]')).toBeInTheDocument();
  expect(api).toBeTruthy();

  act(() => {
    api.notifyOverlayOpen();
  });
  expect(document.querySelector('[data-rainy-dock="closed"]')).toBeInTheDocument();
  expect(document.querySelector('[data-rainy-overlay="hold"]')).toBeInTheDocument();
  expect(screen.getByLabelText("Probe card")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Identity" })).toBeInTheDocument();
  expect(document.querySelector(".tt-rainy-card-grid--overlay-hold")).toBeInTheDocument();

  act(() => {
    api.notifyOverlayClose();
  });
  expect(document.querySelector('[data-rainy-dock="open"]')).toBeInTheDocument();
  expect(document.querySelector('[data-rainy-overlay="off"]')).toBeInTheDocument();
  expect(screen.getByLabelText("Probe card")).toBeInTheDocument();
});

it("ignores repeated overlay opens and restores the first saved dock state", () => {
  let api;
  function Probe() {
    api = useRainyDockOverlay();
    return <section aria-label="Probe card" />;
  }
  render(
    <RainyDashboardLayout
      scene={<section aria-label="Rainy store" />}
      leftColumn={<Probe />}
      rightColumn={null}
      dockTitles={[{ id: "statsPanel", label: "Identity" }]}
      defaultExpanded
    />,
  );

  act(() => {
    api.notifyOverlayOpen();
  });
  expect(document.querySelector('[data-rainy-dock="closed"]')).toBeInTheDocument();
  act(() => {
    api.notifyOverlayOpen();
  });
  act(() => {
    api.notifyOverlayClose();
  });
  expect(document.querySelector('[data-rainy-dock="open"]')).toBeInTheDocument();
  expect(screen.getByLabelText("Probe card")).toBeInTheDocument();
});
