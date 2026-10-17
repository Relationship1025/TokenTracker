import React, { useRef, useState } from "react";
import { AlertTriangle, Download, RotateCcw, Upload } from "lucide-react";
import { getLocalApiAuthHeaders } from "../../lib/local-api-auth.ts";
import { copy } from "../../lib/copy";
import { Button } from "../../ui/components/Button.jsx";
import { SectionCard } from "./Controls.jsx";

function totalTokens(snapshot) {
  return (snapshot?.rows || []).reduce((sum, row) => sum + Number(row.total_tokens || 0), 0);
}

function summarizeSnapshot(snapshot) {
  const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
  return {
    source: snapshot?.origin_name || snapshot?.origin_id || copy("settings.transfer.unknown_source"),
    date: snapshot?.exported_at ? new Date(snapshot.exported_at).toLocaleString() : copy("settings.transfer.unknown_date"),
    rowCount: rows.length,
    tokens: totalTokens(snapshot),
  };
}

function readFileText(file) {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error(copy("settings.transfer.invalid_file")));
    reader.readAsText(file);
  });
}

export function DataTransferSection() {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exportName, setExportName] = useState("");

  const request = async (url, options = {}) => {
    const headers = { ...(await getLocalApiAuthHeaders()), ...(options.headers || {}) };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) throw new Error(`${copy("settings.transfer.request_failed")} (${response.status})`);
    return response;
  };

  const handleExport = async () => {
    setBusy(true); setError("");
    try {
      const query = exportName.trim() ? `?name=${encodeURIComponent(exportName.trim())}` : "";
      const response = await request(`/api/local-transfer/export${query}`);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "tokentracker-usage.json";
      link.click();
      URL.revokeObjectURL(href);
    } catch (err) { setError(err.message || copy("settings.transfer.request_failed")); }
    finally { setBusy(false); }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setPreview(null); setConfirming(false);
    try {
      const snapshot = JSON.parse(await readFileText(file));
      const response = await request("/api/local-transfer/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      const result = await response.json();
      setPreview({ snapshot, summary: { ...summarizeSnapshot(snapshot), ...(result.summary || {}) }, action: result.action });
    } catch (err) { setError(err.message || copy("settings.transfer.invalid_file")); }
    finally { setBusy(false); }
  };

  const handleImport = async () => {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      await request("/api/local-transfer/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: preview.snapshot }),
      });
      setUndoAvailable(true); setConfirming(false);
    } catch (err) { setError(err.message || copy("settings.transfer.request_failed")); }
    finally { setBusy(false); }
  };

  const handleUndo = async () => {
    setBusy(true); setError("");
    try { await request("/api/local-transfer/undo", { method: "POST" }); setUndoAvailable(false); }
    catch (err) { setError(err.message || copy("settings.transfer.request_failed")); }
    finally { setBusy(false); }
  };

  return (
    <SectionCard title={copy("settings.transfer.title")} subtitle={copy("settings.transfer.subtitle")}>
      <div className="space-y-4 py-3">
        <p className="text-sm text-oai-gray-600 dark:text-oai-gray-300">{copy("settings.transfer.description")}</p>
        <label className="block text-sm text-oai-gray-600 dark:text-oai-gray-300">
          {copy("settings.transfer.name_label")}
          <input value={exportName} onChange={(event) => setExportName(event.target.value)} placeholder={copy("settings.transfer.name_placeholder")} className="mt-1 block w-full rounded-md border border-oai-gray-300 bg-transparent px-2.5 py-1.5 text-sm text-oai-black outline-none focus:border-oai-brand-500 dark:border-oai-gray-700 dark:text-white" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleExport} disabled={busy}><Download size={15} className="mr-1.5" aria-hidden />{copy("settings.transfer.export")}</Button>
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={15} className="mr-1.5" aria-hidden />{copy("settings.transfer.choose_file")}</Button>
          <input ref={inputRef} type="file" accept="application/json,.json" className="sr-only" aria-label={copy("settings.transfer.choose_file")} onChange={handleFile} />
        </div>
        <p className="text-xs text-oai-gray-500 dark:text-oai-gray-400">{copy("settings.transfer.account_source_warning")}</p>
        {preview ? (
          <div className="rounded-md border border-oai-gray-200 p-3 text-sm dark:border-oai-gray-700">
            <div className="grid gap-1 sm:grid-cols-2">
              <div><span className="text-oai-gray-500">{copy("settings.transfer.source_label")}: </span>{preview.summary.source}</div>
              <div><span className="text-oai-gray-500">{copy("settings.transfer.date_label")}: </span>{preview.summary.date}</div>
              <div><span className="text-oai-gray-500">{copy("settings.transfer.rows_label")}: </span>{preview.summary.rowCount ?? preview.summary.row_count}</div>
              <div><span className="text-oai-gray-500">{copy("settings.transfer.tokens_label")}: </span>{preview.summary.tokens ?? preview.summary.total_tokens}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setConfirming(true)} disabled={busy || preview.action === "noop"}><Upload size={15} className="mr-1.5" aria-hidden />{copy("settings.transfer.import")}</Button>
              {undoAvailable ? <Button size="sm" variant="secondary" onClick={handleUndo} disabled={busy}><RotateCcw size={15} className="mr-1.5" aria-hidden />{copy("settings.transfer.undo")}</Button> : null}
            </div>
          </div>
        ) : null}
        {confirming ? (
          <div role="dialog" aria-labelledby="transfer-confirm-title" className="rounded-md border border-oai-gray-300 p-3 dark:border-oai-gray-700">
            <h3 id="transfer-confirm-title" className="font-medium">{copy("settings.transfer.confirm_title")}</h3>
            <p className="mt-1 text-sm text-oai-gray-500">{copy("settings.transfer.confirm_description")}</p>
            <div className="mt-3 flex gap-2"><Button size="sm" onClick={handleImport} disabled={busy}>{copy("settings.transfer.confirm")}</Button><Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>{copy("settings.transfer.cancel")}</Button></div>
          </div>
        ) : null}
        {error ? <div role="alert" className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={15} aria-hidden />{error}</div> : null}
      </div>
    </SectionCard>
  );
}
