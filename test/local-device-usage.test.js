const test = require('node:test');
const assert = require('node:assert/strict');

const { createSnapshot } = require('../src/lib/local-transfer');
const { aggregateLocalDeviceUsage } = require('../src/lib/local-device-usage');

const row = (hour_start, total_tokens, billable_total_tokens = undefined) => ({
  hour_start,
  source: 'claude',
  model: 'claude-sonnet',
  input_tokens: total_tokens,
  output_tokens: 0,
  cached_input_tokens: 0,
  cache_creation_input_tokens: 0,
  reasoning_output_tokens: 0,
  total_tokens,
  ...(billable_total_tokens === undefined ? {} : { billable_total_tokens }),
  conversation_count: 1,
});

const snapshot = (originId, originName, rows, revision = 1, exportedAt = '2026-10-18T00:00:00Z') =>
  createSnapshot({
    rows: rows.map((entry) => ({ billable_total_tokens: entry.total_tokens, ...entry })),
    originId,
    originName,
    generationId: `generation-${originId}`,
    revision,
    appVersion: 'test',
    exportedAt,
  });

test('aggregates local and imported totals and falls back billable to total', () => {
  const result = aggregateLocalDeviceUsage({
    localRows: [row('2026-10-18T10:00:00Z', 10, 7)],
    importedSnapshots: [snapshot('remote-1', 'Laptop', [row('2026-10-18T11:00:00Z', 20)])],
    localDevice: { id: 'local-1', name: 'Desktop' },
  });

  assert.deepEqual(result.devices, [
    { id: 'local-1', name: 'Desktop', kind: 'local', total_tokens: 10, billable_total_tokens: 7 },
    { id: 'remote-1', name: 'Laptop', kind: 'imported', total_tokens: 20, billable_total_tokens: 20 },
  ]);
  assert.deepEqual(result.totals, { total_tokens: 30, billable_total_tokens: 27 });
});

test('filters rows by local API day-key semantics and requested timezone', () => {
  const result = aggregateLocalDeviceUsage({
    localRows: [
      row('2026-10-18T00:30:00Z', 10),
      row('2026-10-19T00:30:00Z', 20),
    ],
    importedSnapshots: [],
    localDevice: { id: 'local-1', name: 'Desktop' },
    from: '2026-10-18',
    to: '2026-10-18',
    timeZoneContext: { timeZone: 'America/Los_Angeles' },
  });

  assert.equal(result.devices[0].total_tokens, 20);
  assert.equal(result.totals.total_tokens, 20);
});

test('omits devices with no usage in the selected range', () => {
  const result = aggregateLocalDeviceUsage({
    localRows: [row('2026-10-17T10:00:00Z', 10)],
    importedSnapshots: [snapshot('remote-1', 'Laptop', [row('2026-10-18T10:00:00Z', 20)])],
    localDevice: { id: 'local-1', name: 'Desktop' },
    from: '2026-10-18',
    to: '2026-10-18',
  });

  assert.deepEqual(result.devices.map((device) => device.id), ['remote-1']);
});

test('uses the newer snapshot revision for the same origin', () => {
  const result = aggregateLocalDeviceUsage({
    localRows: [],
    importedSnapshots: [
      snapshot('remote-1', 'Laptop', [row('2026-10-18T10:00:00Z', 10)], 1),
      snapshot('remote-1', 'Laptop', [row('2026-10-18T10:00:00Z', 30)], 2),
    ],
    localDevice: { id: 'local-1', name: 'Desktop' },
  });

  assert.equal(result.devices[0].total_tokens, 30);
});

test('excludes an imported snapshot whose origin matches the local machine id', () => {
  const result = aggregateLocalDeviceUsage({
    localRows: [row('2026-10-18T10:00:00Z', 10)],
    importedSnapshots: [snapshot('local-1', 'Desktop export', [row('2026-10-18T11:00:00Z', 99)])],
    localDevice: { id: 'local-1', name: 'Desktop' },
  });

  assert.deepEqual(result.devices, [
    { id: 'local-1', name: 'Desktop', kind: 'local', total_tokens: 10, billable_total_tokens: 10 },
  ]);
});
