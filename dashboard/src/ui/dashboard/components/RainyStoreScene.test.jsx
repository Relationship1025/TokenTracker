import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("./RainyStoreStatic.jsx", () => ({
  RainyStoreStatic: () => <img alt="Rainy store" data-rainy-store-mode="static" />,
}));
vi.mock("../../../lib/copy", () => ({ copy: (key) => key }));

const { RainyStoreScene } = await import("./RainyStoreScene.jsx");

it("falls back without WebGL and offers no in-scene UI", async () => {
  const { rerender } = render(<RainyStoreScene active={false} />);
  expect(screen.getByRole("img", { name: "Rainy store" })).toBeInTheDocument();
  expect(document.querySelector("[data-rainy-store-mode='webgl']")).toBeNull();

  rerender(<RainyStoreScene active reducedMotion />);
  expect(screen.getByRole("img", { name: "Rainy store" })).toBeInTheDocument();
});
