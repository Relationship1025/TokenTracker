import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setCopyLocale, copy } from "../../lib/copy";
import { DataTransferSection } from "./DataTransferSection.jsx";

const snapshot = {
  schema: "tokentracker.local-usage.v1",
  origin_id: "origin-1",
  origin_name: "Laptop",
  exported_at: "2026-10-17T00:00:00.000Z",
  rows: [
    { source: "codex", model: "gpt-6.1-sol", total_tokens: 120 },
    { source: "cursor", model: "gpt-5", total_tokens: 80 },
  ],
};

beforeEach(() => {
  setCopyLocale("en");
  vi.restoreAllMocks();
  global.fetch = vi.fn(async (url) => {
    if (url === "/api/local-auth") return { ok: true, json: async () => ({ token: "test-token" }) };
    if (url.startsWith("/api/local-transfer/export")) {
      return { ok: true, blob: async () => new Blob([JSON.stringify(snapshot)], { type: "application/json" }) };
    }
    return { ok: true, json: async () => ({ summary: { source: "Laptop", row_count: 2, total_tokens: 200 }, action: "new" }) };
  });
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

it("exports a snapshot with the local auth header", async () => {
  render(<DataTransferSection />);
  fireEvent.click(screen.getByRole("button", { name: copy("settings.transfer.export") }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    "/api/local-transfer/export",
    expect.objectContaining({ headers: { "x-tokentracker-local-auth": "test-token" } }),
  ));
});

it("previews a selected file and discloses account-level source exclusions", async () => {
  render(<DataTransferSection />);
  const file = new File([JSON.stringify(snapshot)], "usage.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText(copy("settings.transfer.choose_file")), { target: { files: [file] } });
  expect(await screen.findByText("Laptop")).toBeInTheDocument();
  expect(screen.getByText(copy("settings.transfer.account_source_warning"))).toBeInTheDocument();
  expect(screen.getByText(/200/)).toBeInTheDocument();
});

it("requires confirmation before importing and offers undo after success", async () => {
  render(<DataTransferSection />);
  const file = new File([JSON.stringify(snapshot)], "usage.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText(copy("settings.transfer.choose_file")), { target: { files: [file] } });
  fireEvent.click(await screen.findByRole("button", { name: copy("settings.transfer.import") }));
  expect(screen.getByText(copy("settings.transfer.confirm_title"))).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: copy("settings.transfer.confirm") }));
  expect(await screen.findByRole("button", { name: copy("settings.transfer.undo") })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: copy("settings.transfer.undo") }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    "/api/local-transfer/undo",
    expect.objectContaining({ method: "POST" }),
  ));
});
