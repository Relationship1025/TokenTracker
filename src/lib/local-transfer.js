const crypto = require('node:crypto');

const SCHEMA = 'tokentracker.local-usage.v1';
const ROW_FIELDS = [
  'hour_start', 'source', 'model',
  'input_tokens', 'output_tokens', 'cached_input_tokens',
  'cache_creation_input_tokens', 'reasoning_output_tokens',
  'total_tokens', 'billable_total_tokens', 'conversation_count',
];
const NUMERIC_FIELDS = ROW_FIELDS.slice(3);
const ACCOUNT_LEVEL_SOURCES = new Set(['cursor', 'trae-cn']);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashSnapshotContent(snapshot) {
  const content = {
    schema: snapshot.schema,
    origin_id: snapshot.origin_id,
    origin_name: snapshot.origin_name,
    generation_id: snapshot.generation_id,
    revision: snapshot.revision,
    exported_at: snapshot.exported_at,
    app_version: snapshot.app_version,
    rows: snapshot.rows,
  };
  return `sha256:${crypto.createHash('sha256').update(stableJson(content)).digest('hex')}`;
}

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateRow(row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`row ${index} must be an object`);
  const unknown = Object.keys(row).filter((key) => !ROW_FIELDS.includes(key));
  if (unknown.length) throw new Error(`row ${index} contains unknown or non-allowlist fields: ${unknown.join(',')}`);
  for (const field of ['hour_start', 'source', 'model']) {
    if (!isString(row[field])) throw new Error(`row ${index} ${field} is required`);
  }
  if (Number.isNaN(Date.parse(row.hour_start))) throw new Error(`row ${index} hour_start must be a date`);
  for (const field of NUMERIC_FIELDS) {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) throw new Error(`row ${index} ${field} must be finite`);
    if (row[field] < 0) throw new Error(`row ${index} ${field} cannot be negative`);
  }
  return row;
}

function bucketKey(row) {
  return `${row.source}\u0000${row.model}\u0000${row.hour_start}`;
}

function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('snapshot must be an object');
  if (value.schema !== SCHEMA) throw new Error(`schema must be ${SCHEMA}`);
  for (const field of ['origin_id', 'origin_name', 'generation_id', 'app_version']) {
    if (!isString(value[field])) throw new Error(`${field} is required`);
  }
  if (!Number.isInteger(value.revision) || value.revision < 0) throw new Error('revision must be a non-negative integer');
  if (!isString(value.exported_at) || Number.isNaN(Date.parse(value.exported_at))) throw new Error('exported_at must be a date');
  if (!Array.isArray(value.rows)) throw new Error('rows must be an array');
  const keys = new Set();
  for (let i = 0; i < value.rows.length; i += 1) {
    const row = validateRow(value.rows[i], i);
    const key = bucketKey(row);
    if (keys.has(key)) throw new Error(`duplicate bucket key: ${key}`);
    keys.add(key);
  }
  if (!isString(value.content_hash) || !/^sha256:[0-9a-f]{64}$/.test(value.content_hash)) throw new Error('content_hash must be sha256 hex');
  if (hashSnapshotContent(value) !== value.content_hash) throw new Error('content_hash does not match snapshot content');
  return value;
}

function createSnapshot({ rows, originId, originName, generationId, revision, appVersion, exportedAt }) {
  const value = {
    schema: SCHEMA,
    origin_id: originId,
    origin_name: originName,
    generation_id: generationId,
    revision,
    exported_at: exportedAt,
    app_version: appVersion,
    rows: Array.isArray(rows) ? rows.map((row) => ({ ...row })) : rows,
  };
  for (let i = 0; Array.isArray(value.rows) && i < value.rows.length; i += 1) validateRow(value.rows[i], i);
  value.content_hash = hashSnapshotContent(value);
  return validateSnapshot(value);
}

function summarizeSnapshot(snapshot) {
  const value = validateSnapshot(snapshot);
  return {
    origin_id: value.origin_id,
    origin_name: value.origin_name,
    revision: value.revision,
    generation_id: value.generation_id,
    exported_at: value.exported_at,
    row_count: value.rows.length,
    total_tokens: value.rows.reduce((sum, row) => sum + row.total_tokens, 0),
    billable_total_tokens: value.rows.reduce((sum, row) => sum + row.billable_total_tokens, 0),
  };
}

function addRows(target, rows) {
  for (const row of rows) {
    const key = bucketKey(row);
    const existing = target.get(key);
    if (!existing) {
      target.set(key, { ...row });
      continue;
    }
    for (const field of NUMERIC_FIELDS) existing[field] += row[field];
  }
}

function mergeTransferredRows(localRows, snapshots) {
  if (!Array.isArray(localRows) || !Array.isArray(snapshots)) throw new Error('localRows and snapshots must be arrays');
  for (let i = 0; i < localRows.length; i += 1) validateRow(localRows[i], `local ${i}`);
  const origins = [];
  const accepted = new Map();
  const undoEvents = [];
  for (const raw of snapshots) {
    const snapshot = validateSnapshot(raw);
    const prior = accepted.get(snapshot.origin_id);
    let action = 'new';
    let undo;
    if (prior) {
      if (snapshot.revision < prior.revision) action = 'stale';
      else if (snapshot.revision === prior.revision) action = snapshot.content_hash === prior.content_hash ? 'noop' : 'conflict';
      else {
        action = 'replace';
        undo = { origin_id: snapshot.origin_id, previous: prior, replacement: snapshot };
        undoEvents.push(undo);
      }
    }
    origins.push({ origin_id: snapshot.origin_id, revision: snapshot.revision, action });
    if (action === 'new' || action === 'replace') accepted.set(snapshot.origin_id, snapshot);
  }
  const merged = new Map();
  addRows(merged, localRows);
  const excludedSources = new Set();
  for (const snapshot of accepted.values()) {
    addRows(merged, snapshot.rows.filter((row) => {
      if (ACCOUNT_LEVEL_SOURCES.has(row.source)) {
        excludedSources.add(row.source);
        return false;
      }
      return true;
    }));
  }
  return {
    rows: [...merged.values()],
    origins,
    excluded_sources: [...excludedSources],
    undo: undoEvents.length ? undoEvents[undoEvents.length - 1] : undefined,
  };
}

module.exports = { SCHEMA, ROW_FIELDS, NUMERIC_FIELDS, createSnapshot, validateSnapshot, mergeTransferredRows, summarizeSnapshot };
