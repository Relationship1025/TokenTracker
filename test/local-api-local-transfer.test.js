const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createLocalApiHandler } = require("../src/lib/local-api");
const { createSnapshot } = require("../src/lib/local-transfer");

function transferRow(overrides = {}) {
  return {
    hour_start: "2026-10-16T13:00:00.000Z",
    source: "codex",
    model: "gpt-6.1-sol",
    input_tokens: 10,
    output_tokens: 20,
    cached_input_tokens: 0,
    cache_creation_input_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 30,
    billable_total_tokens: 30,
    conversation_count: 1,
    ...overrides,
  };
}

function makeSnapshot(overrides = {}) {
  return createSnapshot({
    rows: [transferRow()],
    originId: "origin-secondary",
    originName: "Laptop",
    generationId: "generation-secondary",
    revision: 1,
    appVersion: "1.4.4",
    exportedAt: "2026-10-17T00:00:00.000Z",
    ...overrides,
  });
}

async function makeHarness(localRows = []) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tt-local-transfer-api-"));
  const queuePath = path.join(dir, "queue.jsonl");
  await fs.promises.writeFile(queuePath, localRows.length ? `${localRows.map(JSON.stringify).join("\n")}\n` : "");
  const handler = createLocalApiHandler({ queuePath, trackerDataDir: dir });
  const call = async (endpoint, { method = "GET", body, headers = {} } = {}) => {
    const url = new URL(`http://localhost${endpoint}`);
    const chunks = [];
    const req = {
      method,
      url: url.pathname + url.search,
      headers: { host: "localhost", ...(body ? { "content-length": Buffer.byteLength(body) } : {}), ...headers },
      on(event, listener) {
        if (event === "data" && body) queueMicrotask(() => listener(Buffer.from(body)));
        if (event === "end") queueMicrotask(listener);
        return this;
      },
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      writeHead(status, headersToSet) { this.statusCode = status; Object.assign(this.headers, headersToSet || {}); },
      write(chunk) { chunks.push(chunk); },
      end(value) { if (value) chunks.push(value); },
    };
    const handled = await handler(req, res, url);
    assert.equal(handled, true, `endpoint must be handled: ${endpoint}`);
    const raw = Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))).toString("utf8");
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* export is JSON too, but keep raw for diagnostics */ }
    return { status: res.statusCode, headers: res.headers, raw, body: parsed };
  };
  const auth = await call("/api/local-auth");
  const authHeaders = { "x-tokentracker-local-auth": auth.body.token };
  return { dir, queuePath, call, authHeaders };
}

test("local transfer endpoints enforce auth and export local queue only", async () => {
  const local = transferRow({ total_tokens: 11, input_tokens: 1, output_tokens: 10, billable_total_tokens: undefined, total_cost_usd: "1.23" });
  const h = await makeHarness([local]);
  try {
    const snapshot = makeSnapshot();
    const unauthorized = await h.call("/api/local-transfer/preview", { method: "POST", body: JSON.stringify({ snapshot }) });
    assert.equal(unauthorized.status, 401);

    const imported = await h.call("/api/local-transfer/import", { method: "POST", headers: h.authHeaders, body: JSON.stringify({ snapshot }) });
    assert.equal(imported.status, 200);
    const exported = await h.call("/api/local-transfer/export");
    assert.equal(exported.status, 200);
    const exportedSnapshot = exported.body;
    assert.equal(exportedSnapshot.rows.length, 1);
    assert.equal(exportedSnapshot.rows[0].total_tokens, 11);
    assert.equal(exportedSnapshot.rows[0].billable_total_tokens, 11);
    assert.equal(Object.hasOwn(exportedSnapshot.rows[0], "total_cost_usd"), false);
    assert.notEqual(exportedSnapshot.origin_id, snapshot.origin_id);
    const secondExport = await h.call("/api/local-transfer/export");
    assert.equal(secondExport.body.revision, exportedSnapshot.revision + 1);
  } finally {
    await fs.promises.rm(h.dir, { recursive: true, force: true });
  }
});

test("preview, atomic import, merged totals, conflict/stale handling, and undo", async () => {
  const local = transferRow({ total_tokens: 10, input_tokens: 5, output_tokens: 5 });
  const h = await makeHarness([local]);
  try {
    const first = makeSnapshot();
    const preview = await h.call("/api/local-transfer/preview", { method: "POST", headers: h.authHeaders, body: JSON.stringify({ snapshot: first }) });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.action, "new");
    assert.equal(preview.body.summary.total_tokens, 30);

    const imported = await h.call("/api/local-transfer/import", { method: "POST", headers: h.authHeaders, body: JSON.stringify({ snapshot: first }) });
    assert.equal(imported.status, 200);
    const summary = await h.call("/functions/tokentracker-usage-summary?from=2026-10-16&to=2026-10-16&tz=UTC");
    assert.equal(summary.body.totals.total_tokens, 40);

    const same = await h.call("/api/local-transfer/preview", { method: "POST", headers: h.authHeaders, body: JSON.stringify({ snapshot: first }) });
    assert.equal(same.body.action, "noop");
    const conflict = makeSnapshot({ rows: [transferRow({ output_tokens: 21, total_tokens: 31, billable_total_tokens: 31 })] });
    const conflictResult = await h.call("/api/local-transfer/preview", { method: "POST", headers: h.authHeaders, body: JSON.stringify({ snapshot: conflict }) });
    assert.equal(conflictResult.status, 409);
    assert.equal(conflictResult.body.action, "conflict");

    const newer = makeSnapshot({ revision: 2, rows: [transferRow({ total_tokens: 50, input_tokens: 25, output_tokens: 25, billable_total_tokens: 50 })] });
    const replacement = await h.call("/api/local-transfer/import", { method: "POST", headers: h.authHeaders, body: JSON.stringify({ snapshot: newer }) });
    assert.equal(replacement.status, 200);
    assert.equal(replacement.body.action, "replace");
    const replacedSummary = await h.call("/functions/tokentracker-usage-summary?from=2026-10-16&to=2026-10-16&tz=UTC");
    assert.equal(replacedSummary.body.totals.total_tokens, 60);

    const stale = makeSnapshot({ revision: 1, rows: [] });
    const staleResult = await h.call("/api/local-transfer/preview", { method: "POST", headers: h.authHeaders, body: JSON.stringify({ snapshot: stale }) });
    assert.equal(staleResult.status, 409);
    assert.equal(staleResult.body.action, "stale");

    const undo = await h.call("/api/local-transfer/undo", { method: "POST", headers: h.authHeaders });
    assert.equal(undo.status, 200);
    const undoneSummary = await h.call("/functions/tokentracker-usage-summary?from=2026-10-16&to=2026-10-16&tz=UTC");
    assert.equal(undoneSummary.body.totals.total_tokens, 40);

    const beforeBad = await h.call("/functions/tokentracker-usage-summary?from=2026-10-16&to=2026-10-16&tz=UTC");
    const bad = await h.call("/api/local-transfer/import", { method: "POST", headers: h.authHeaders, body: JSON.stringify({ snapshot: { ...first, prompt: "do not persist me" } }) });
    assert.equal(bad.status, 400);
    const afterBad = await h.call("/functions/tokentracker-usage-summary?from=2026-10-16&to=2026-10-16&tz=UTC");
    assert.equal(afterBad.body.totals.total_tokens, beforeBad.body.totals.total_tokens);
    const state = JSON.parse(await fs.promises.readFile(path.join(h.dir, "imports", "state.json"), "utf8"));
    assert.equal(JSON.stringify(state).includes("do not persist me"), false);
  } finally {
    await fs.promises.rm(h.dir, { recursive: true, force: true });
  }
});

test("project usage summary includes imported rows when no project queue exists", async () => {
  const h = await makeHarness([]);
  try {
    const imported = await h.call("/api/local-transfer/import", {
      method: "POST",
      headers: h.authHeaders,
      body: JSON.stringify({ snapshot: makeSnapshot({ rows: [transferRow({ total_tokens: 45, input_tokens: 15, output_tokens: 30, billable_total_tokens: 45 })] }) }),
    });
    assert.equal(imported.status, 200);

    const summary = await h.call("/functions/tokentracker-project-usage-summary");
    assert.equal(summary.status, 200);
    assert.equal(summary.body.entries.length, 1);
    assert.equal(summary.body.entries[0].project_key, "codex");
    assert.equal(summary.body.entries[0].total_tokens, "45");
    assert.equal(summary.body.entries[0].billable_total_tokens, "45");
  } finally {
    await fs.promises.rm(h.dir, { recursive: true, force: true });
  }
});

test("re-importing this computer's own export does not double-count local usage", async () => {
  const local = transferRow({ total_tokens: 17, input_tokens: 7, output_tokens: 10 });
  const h = await makeHarness([local]);
  try {
    const exported = await h.call("/api/local-transfer/export");
    assert.equal(exported.status, 200);
    const imported = await h.call("/api/local-transfer/import", {
      method: "POST",
      headers: h.authHeaders,
      body: JSON.stringify({ snapshot: exported.body }),
    });
    assert.equal(imported.status, 200);
    const summary = await h.call("/functions/tokentracker-usage-summary?from=2026-10-16&to=2026-10-16&tz=UTC");
    assert.equal(summary.body.totals.total_tokens, 17);
  } finally {
    await fs.promises.rm(h.dir, { recursive: true, force: true });
  }
});

