# Local Data Transfer Design

## Goal

Allow a user to move token usage from secondary computers to a primary computer with a file, without a cloud service or a shared live queue.

## Decisions

- The transfer file contains only normalized token usage buckets and cost inputs. It does not contain prompts, responses, code, paths, session identifiers, credentials, or parser cursors.
- Each exporting computer has a stable anonymous origin id and a user-editable display name.
- The primary computer stores imported snapshots separately from its local queue. Dashboard reads combine the current local queue with the latest accepted snapshot for each origin.
- A newer complete snapshot replaces that origin's previous snapshot. Re-importing the same snapshot is a no-op. Older revisions cannot roll data back. A same-revision hash conflict is rejected.
- Imported Cursor and TRAE CN rows remain in the snapshot for auditability but are excluded from combined totals because those sources can represent account-level usage shared by multiple computers.
- Export reads the local queue only. It never re-exports imported snapshots.
- Import is preview-first and atomic. The previous snapshot is retained for one-step undo.

## Format

```json
{
  "schema": "tokentracker.local-usage.v1",
  "origin_id": "stable-anonymous-id",
  "origin_name": "Laptop",
  "generation_id": "uuid",
  "revision": 3,
  "exported_at": "2026-10-17T00:00:00.000Z",
  "app_version": "1.4.4",
  "rows": [{
    "hour_start": "2026-10-16T13:00:00.000Z",
    "source": "codex",
    "model": "gpt-6.1-sol",
    "input_tokens": 10,
    "output_tokens": 20,
    "cached_input_tokens": 0,
    "cache_creation_input_tokens": 0,
    "reasoning_output_tokens": 0,
    "total_tokens": 30,
    "billable_total_tokens": 30,
    "conversation_count": 1
  }],
  "content_hash": "sha256:..."
}
```

The sample `tokentracker-2026-10.csv` is the existing session analytics export. It includes session/project metadata and `model_usage_json`, so it remains useful for session analysis but is not used as the cross-computer snapshot format. The new transfer format is intentionally smaller and safe to merge by hour.

## Components

- `src/lib/local-transfer.js`: snapshot validation, revision state, atomic storage, preview summaries, undo, and merge helpers.
- `src/lib/local-api.js`: local transfer endpoints and merged queue reads.
- `dashboard/src/components/settings/DataTransferSection.jsx`: export, file selection, preview, import, and undo controls.
- `dashboard/src/pages/SettingsPage.jsx` and `dashboard/src/content/copy.csv`: settings navigation and user-facing copy.

## Error handling

Reject malformed JSON, an unknown schema, an origin mismatch, duplicate bucket keys, non-finite or negative counters, oversized files, invalid revisions, and hash conflicts before writing anything. Keep imported data out of local sync cursors and upload offsets.

## Verification

Test same-origin replacement, duplicate import, old-revision rejection, same-revision conflict, zero-value bucket replacement, two-origin aggregation, account-level source exclusion, export isolation from imports, undo, malformed input, and atomic failure behavior. Run the existing local API tests and dashboard tests after the feature tests.
