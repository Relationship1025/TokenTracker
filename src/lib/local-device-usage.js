const { validateSnapshot } = require('./local-transfer');

function dayKey(row, timeZoneContext) {
  const date = new Date(row?.hour_start);
  if (Number.isNaN(date.getTime())) return '';
  const timeZone = timeZoneContext?.timeZone;
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}`;
    } catch (_error) {
      // Fall through to the fixed offset or host-local semantics used by local-api.
    }
  }
  if (Number.isFinite(timeZoneContext?.offsetMinutes)) {
    const shifted = new Date(date.getTime() + timeZoneContext.offsetMinutes * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
  }
  return row.hour_start.slice(0, 10);
}

function inRange(day, from, to) {
  return (!from && !to) || Boolean(day && (!from || day >= from) && (!to || day <= to));
}

function addRow(target, row) {
  const total = Number(row?.total_tokens || 0);
  const billableValue = row?.billable_total_tokens;
  const billable = Number(billableValue == null ? total : billableValue);
  target.total_tokens += Number.isFinite(total) ? total : 0;
  target.billable_total_tokens += Number.isFinite(billable) ? billable : 0;
}

function aggregateLocalDeviceUsage({
  localRows = [],
  importedSnapshots = [],
  localDevice,
  from = '',
  to = '',
  timeZoneContext = null,
} = {}) {
  const localId = String(localDevice?.id || '');
  const importedByOrigin = new Map();
  for (const rawSnapshot of importedSnapshots) {
    const snapshot = validateSnapshot(rawSnapshot);
    if (!snapshot.origin_id || snapshot.origin_id === localId) continue;
    const prior = importedByOrigin.get(snapshot.origin_id);
    if (!prior || snapshot.revision > prior.revision) importedByOrigin.set(snapshot.origin_id, snapshot);
  }

  const entries = [];
  if (localId) entries.push({ id: localId, name: String(localDevice?.name || localId), kind: 'local', rows: localRows });
  for (const snapshot of importedByOrigin.values()) {
    entries.push({ id: snapshot.origin_id, name: snapshot.origin_name, kind: 'imported', rows: snapshot.rows });
  }

  const totals = { total_tokens: 0, billable_total_tokens: 0 };
  const devices = [];
  for (const entry of entries) {
    const deviceTotals = { total_tokens: 0, billable_total_tokens: 0 };
    for (const row of Array.isArray(entry.rows) ? entry.rows : []) {
      if (!inRange(dayKey(row, timeZoneContext), from, to)) continue;
      addRow(deviceTotals, row);
    }
    if (deviceTotals.total_tokens === 0 && deviceTotals.billable_total_tokens === 0) continue;
    const device = { id: entry.id, name: entry.name, kind: entry.kind, ...deviceTotals };
    devices.push(device);
    totals.total_tokens += device.total_tokens;
    totals.billable_total_tokens += device.billable_total_tokens;
  }
  return { devices, totals };
}

module.exports = { aggregateLocalDeviceUsage };
