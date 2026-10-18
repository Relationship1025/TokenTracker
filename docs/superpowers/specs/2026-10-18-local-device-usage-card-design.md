# Local Device Usage Card Design

## Goal

Restore the dashboard's device usage card for local installations. A user can
export usage from another computer as the existing JSON transfer snapshot,
import that file on this computer, and see the local computer and every
imported computer listed separately with token totals for the selected date
range.

## Scope

- Reuse the existing local JSON transfer format and revision semantics.
- Keep imported snapshots in the existing `imports/state.json` store.
- Add a read-only local API response that aggregates local queue rows and
  imported snapshot rows by origin and date range.
- Restore a `DeviceUsageCard` in the dashboard's left card column.
- Keep the feature local-only; do not add cloud or InsForge dependencies.
- Do not add device filtering or rename controls in this change.

## Data model and aggregation

The current machine is represented by its stable local machine id and system
device name. Imported machines are represented by each snapshot's
`origin_id` and `origin_name`. For a requested `[from, to]` range, the API
filters rows by `hour_start` using the same range and timezone conventions as
the existing usage endpoints, then sums `total_tokens` and
`billable_total_tokens` for each device. The API also returns the overall
total needed to calculate percentages in the card.

The existing transfer rules remain authoritative: a newer revision replaces
the prior snapshot for the same origin, stale and conflicting revisions are
rejected, and importing this computer's own export is excluded from the
merged local view so it cannot double-count the local queue.

## API

Add a local read-only endpoint under the existing local function routing,
following the shape of the usage summary endpoints. It accepts `from`, `to`,
`tz`, and `tz_offset_minutes` and returns:

```json
{
  "devices": [
    {
      "id": "stable-origin-id",
      "name": "MacBook Pro",
      "kind": "local|imported",
      "total_tokens": 123,
      "billable_total_tokens": 123
    }
  ],
  "totals": {
    "total_tokens": 456,
    "billable_total_tokens": 456
  }
}
```

Empty devices are omitted for the selected range. The local API remains
protected by the existing local auth boundary where the other dashboard data
endpoints require it.

## Dashboard behavior

`DeviceUsageCard` is rendered in the left dashboard card stream near the
activity and trend cards. It fetches the new endpoint with the active date
range and displays one row per device with a name, local/imported indicator,
token total, and proportional bar. It renders a loading state while the
request is pending and an empty state only when no device has usage in the
selected range. The card is independent of screenshot mode and does not
change existing overall usage totals.

## Error handling and compatibility

- Invalid or unavailable local data follows the existing dashboard fetch
  error behavior and leaves the rest of the dashboard usable.
- Malformed imported snapshots are still rejected by the existing transfer
  validator before they can affect this card.
- Existing imports and exports remain byte-compatible; no new snapshot fields
  are required.
- Existing local usage summary totals continue to use the merged queue view.

## Verification

- Unit tests for per-device aggregation across local and imported rows,
  date-range filtering, replacement revisions, and self-import exclusion.
- Component tests for loading, empty, local/imported rows, and percentages.
- Dashboard view test confirming the card is registered and receives the
  selected range.
- Run the focused tests, then the dashboard test suite and relevant local API
  tests.
