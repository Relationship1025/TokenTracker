import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataTransferPage } from "./DataTransferPage.jsx";

vi.mock("../components/settings/DataTransferSection.jsx", () => ({
  DataTransferSection: () => <div>Local data transfer panel</div>,
}));

vi.mock("../lib/copy", () => ({
  copy: (key) => ({
    "settings.section.transfer": "Data transfer",
    "settings.section.transfer.description": "Move local token usage between computers.",
  }[key] || key),
}));

describe("DataTransferPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the data transfer panel as a standalone dashboard page", () => {
    render(<DataTransferPage />);

    expect(screen.getByRole("heading", { name: "Data transfer" })).toBeInTheDocument();
    expect(screen.getByText("Local data transfer panel")).toBeInTheDocument();
  });
});
