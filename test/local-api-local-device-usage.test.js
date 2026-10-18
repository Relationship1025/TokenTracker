const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createLocalApiHandler, getOrCreateMachineId, getSystemDeviceName } = require("../src/lib/local-api");
const { createSnapshot } = require("../src/lib/local-transfer");

function row(overrides = {}) {
  return {
    hour_start: "2026-10-16T23:30:00.000Z",
    source: "codex",
    model: "gpt-6.1-sol",
    input_tokens: 10,
    output_tokens: 20,
    cached_input_tokens: 0,
    cache_creation_input_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 30,
    billable_total_tokens: 25,
    conversation_count: 1,
    ...overrides,
  };
}

async function harness(localRows = []) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tt-local-device-usage-api-"));
  const queuePath = path.join(dir, "queue.jsonl");
  await fs.promises.writeFile(queuePath, localRows.length ? `${localRows.map(JSON.stringify).join("\n")}\n` : "");
  const handler = createLocalApiHandler({ queuePath, trackerDataDir: dir });
  const call = async (endpoint, { method = "GET" } = {}) => {
    const url = new URL(`http://localhost${endpoint}`);
    const chunks = [];
    const req = { method, url: url.pathname + url.search, headers: { host: "localhost" }, on(event, listener) { if (event === "end") queueMicrotask(listener); return this; } };
    const res = { statusCode: 200, headers: {}, writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers || {}); }, end(value) { if (value) chunks.push(value); } };
    assert.equal(await handler(req, res, url), true);
    return { status: res.statusCode, body: JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(String(chunk)))).toString("utf8")) };
  };
  return { dir, queuePath, call };
}

function snapshot(originId, originName, revision, rows) {
  return createSnapshot({ rows, originId, originName, generationId: `generation-${originId}`, revision, appVersion: "1.0.0", exportedAt: "2026-10-17T00:00:00.000Z" });
}

async function importSnapshot(h, snap) {
  const statePath = path.join(h.dir, "imports", "state.json");
  await fs.promises.mkdir(path.dirname(statePath), { recursive: true });
  const current = fs.existsSync(statePath) ? JSON.parse(await fs.promises.readFile(statePath, "utf8")) : { version: 1, snapshots: [], undo: null };
  current.snapshots = current.snapshots.filter((entry) => entry.origin_id !== snap.origin_id);
  current.snapshots.push(snap);
  await fs.promises.writeFile(statePath, JSON.stringify(current));
}

test("local device usage returns local and imported totals with zero-use devices omitted", async () => {
  const h = await harness([row({ total_tokens: 10, billable_total_tokens: 8 })]);
  try {
    await importSnapshot(h, snapshot("origin-secondary", "Laptop", 1, [row({ total_tokens: 20, billable_total_tokens: 15 })]));
    await importSnapshot(h, snapshot("origin-empty", "Idle Desktop", 1, [row({ total_tokens: 0, billable_total_tokens: 0 })]));
    const result = await h.call("/functions/tokentracker-local-device-usage?from=2026-10-16&to=2026-10-16&tz=UTC");
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.totals, { total_tokens: 30, billable_total_tokens: 23 });
    assert.deepEqual(result.body.devices.map(({ id, name, kind }) => ({ id, name, kind })), [
      { id: getOrCreateMachineId(h.queuePath), name: getSystemDeviceName(), kind: "local" },
      { id: "origin-secondary", name: "Laptop", kind: "imported" },
    ]);
  } finally { await fs.promises.rm(h.dir, { recursive: true, force: true }); }
});

test("local device usage applies inclusive timezone range and newer revision replacement", async () => {
  const h = await harness([row({ hour_start: "2026-10-17T00:30:00.000Z", total_tokens: 11, billable_total_tokens: 9 })]);
  try {
    await importSnapshot(h, snapshot("origin-secondary", "Laptop", 1, [row({ total_tokens: 20, billable_total_tokens: 10 })]));
    await importSnapshot(h, snapshot("origin-secondary", "Laptop", 2, [row({ hour_start: "2026-10-16T23:30:00.000Z", total_tokens: 40, billable_total_tokens: 30 })]));
    const result = await h.call("/functions/tokentracker-local-device-usage?from=2026-10-16&to=2026-10-16&tz=UTC&tz_offset_minutes=0");
    assert.deepEqual(result.body.totals, { total_tokens: 40, billable_total_tokens: 30 });
    assert.equal(result.body.devices.length, 1);
  } finally { await fs.promises.rm(h.dir, { recursive: true, force: true }); }
});

test("local device usage excludes an imported snapshot from this machine", async () => {
  const local = row({ total_tokens: 17, billable_total_tokens: 17 });
  const h = await harness([local]);
  try {
    const originId = getOrCreateMachineId(h.queuePath);
    await importSnapshot(h, snapshot(originId, "This computer", 1, [row({ total_tokens: 99, billable_total_tokens: 99 })]));
    const result = await h.call("/functions/tokentracker-local-device-usage?from=2026-10-16&to=2026-10-16&tz=UTC");
    assert.deepEqual(result.body.totals, { total_tokens: 17, billable_total_tokens: 17 });
    assert.equal(result.body.devices.length, 1);
  } finally { await fs.promises.rm(h.dir, { recursive: true, force: true }); }
});

test("local device usage is read-only and only accepts GET", async () => {
  const h = await harness([]);
  try {
    const result = await h.call("/functions/tokentracker-local-device-usage", { method: "POST" });
    assert.equal(result.status, 405);
  } finally { await fs.promises.rm(h.dir, { recursive: true, force: true }); }
});
