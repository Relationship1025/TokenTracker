import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RainyStoreStatic } from "./RainyStoreStatic.jsx";

vi.mock("../../../lib/copy", () => ({
  copy: () => "A rainy Japanese convenience store miniature.",
}));

it("renders a deterministic described square miniature without controls", () => {
  render(<RainyStoreStatic />);
  expect(screen.getByRole("img", { name: "A rainy Japanese convenience store miniature." })).toBeInTheDocument();
  expect(screen.getByRole("img")).toHaveAttribute("data-rainy-store-mode", "static");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
