import React from "react";
import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const createRainyStoreScene = vi.hoisted(() => vi.fn());
vi.mock("./rainy-store-scene.js", () => ({ createRainyStoreScene }));

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

it("disposes the live scene when switching away or unmounting", async () => {
  const dispose = vi.fn();
  createRainyStoreScene.mockReturnValue({ dispose, resetView: vi.fn() });
  const { rerender, unmount } = render(<RainyStoreScene active />);
  await act(async () => {
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(createRainyStoreScene).toHaveBeenCalledTimes(1));
  rerender(<RainyStoreScene active={false} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(dispose).toHaveBeenCalledTimes(1);
  unmount();
  expect(dispose).toHaveBeenCalledTimes(1);
});
