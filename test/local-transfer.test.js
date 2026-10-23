const test = require('node:test');
const assert = require('node:assert/strict');
const { createSnapshot, validateSnapshot, mergeTransferredRows, summarizeSnapshot } = require('../src/lib/local-transfer');

const row = (overrides = {}) => ({ hour_start: '2026-10-16T13:00:00.000Z', source: 'codex', model: 'gpt-6.1-sol', input_tokens: 10, output_tokens: 20, cached_input_tokens: 0, cache_creation_input_tokens: 0, reasoning_output_tokens: 0, total_tokens: 30, billable_total_tokens: 30, conversation_count: 1, ...overrides });
const snapshot = (overrides = {}) => createSnapshot({ rows: [row()], originId: 'origin-a', originName: 'Laptop', generationId: 'generation-a', revision: 1, appVersion: '1.4.4', exportedAt: '2026-10-17T00:00:00.000Z', ...overrides });

test('creates and validates a v1 snapshot with a sha256 content hash', () => {
  const value = snapshot();
  assert.equal(value.schema, 'tokentracker.local-usage.v1');
  assert.match(value.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(validateSnapshot(value), value);
  assert.deepEqual(summarizeSnapshot(value), { origin_id: 'origin-a', origin_name: 'Laptop', revision: 1, generation_id: 'generation-a', exported_at: '2026-10-17T00:00:00.000Z', row_count: 1, total_tokens: 30, billable_total_tokens: 30 });
});

test('rejects malformed, nonfinite, negative, duplicate, and unknown row values', () => {
  assert.throws(() => validateSnapshot({}), /schema/i);
  assert.throws(() => validateSnapshot({ ...snapshot(), prompt: 'sensitive content' }), /allowlist|unknown/i);
  assert.throws(() => validateSnapshot(snapshot({ rows: [row({ input_tokens: -1 })] })), /negative/i);
  assert.throws(() => validateSnapshot(snapshot({ rows: [row({ output_tokens: Infinity })] })), /finite/i);
  assert.throws(() => validateSnapshot(snapshot({ rows: [row(), row()] })), /duplicate/i);
  assert.throws(() => validateSnapshot(snapshot({ rows: [row({ unexpected: 1 })] })), /allowlist|unknown/i);
  assert.throws(() => validateSnapshot({ ...snapshot(), content_hash: 'sha256:' + '0'.repeat(64) }), /hash/i);
});

test('same-origin newer snapshot accumulates numeric metrics per bucket', () => {
  const older = snapshot();
  const newer = snapshot({ revision: 2, rows: [row({ input_tokens: 5, output_tokens: 5, total_tokens: 10, billable_total_tokens: 10, conversation_count: 1 })] });
  const merged = mergeTransferredRows([], [older, newer]);
  assert.equal(merged.origins[1].action, 'accumulate');
  assert.equal(merged.rows.length, 1);
  assert.equal(merged.rows[0].input_tokens, 15);
  assert.equal(merged.rows[0].output_tokens, 25);
  assert.equal(merged.rows[0].total_tokens, 40);
  assert.equal(merged.rows[0].conversation_count, 2);
});

test('same revision hash is noop, different hash conflicts, and stale revision is ignored', () => {
  const current = snapshot({ revision: 3 });
  const same = snapshot({ revision: 3 });
  const conflict = snapshot({ revision: 3, rows: [row({ output_tokens: 21, total_tokens: 31, billable_total_tokens: 31 })] });
  const stale = snapshot({ revision: 2, rows: [] });
  assert.equal(mergeTransferredRows([], [current, same]).origins[1].action, 'noop');
  assert.equal(mergeTransferredRows([], [current, conflict]).origins[1].action, 'conflict');
  assert.equal(mergeTransferredRows([], [current, stale]).origins[1].action, 'stale');
});

test('different origins sum numeric metrics while excluding cursor and trae-cn imports', () => {
  const local = row({ input_tokens: 5, output_tokens: 5, total_tokens: 10, billable_total_tokens: 10 });
  const other = snapshot({ originId: 'origin-b', originName: 'Desktop', rows: [row({ input_tokens: 7, output_tokens: 8, total_tokens: 15, billable_total_tokens: 15 })] });
  const excluded = snapshot({ originId: 'origin-c', rows: [row({ source: 'cursor', input_tokens: 100, output_tokens: 100, total_tokens: 200, billable_total_tokens: 200 }), row({ source: 'trae-cn', hour_start: '2026-10-16T14:00:00.000Z', input_tokens: 100, output_tokens: 100, total_tokens: 200, billable_total_tokens: 200 })] });
  const merged = mergeTransferredRows([local], [other, excluded]);
  assert.equal(merged.rows.length, 1);
  assert.equal(merged.rows[0].input_tokens, 12);
  assert.equal(merged.rows[0].total_tokens, 25);
  assert.equal(merged.excluded_sources.sort().join(','), 'cursor,trae-cn');
});

test('empty newer snapshots keep prior rows and expose undo metadata', () => {
  const prior = snapshot({ revision: 1 });
  const empty = snapshot({ revision: 2, rows: [] });
  const merged = mergeTransferredRows([], [prior, empty]);
  assert.equal(merged.origins[1].action, 'accumulate');
  assert.deepEqual(merged.rows, [prior.rows[0]]);
  assert.equal(merged.undo.origin_id, 'origin-a');
  assert.deepEqual(merged.undo.previous, prior);
  assert.equal(merged.undo.replacement.revision, 2);
  assert.deepEqual(merged.undo.replacement.rows, prior.rows);
});
