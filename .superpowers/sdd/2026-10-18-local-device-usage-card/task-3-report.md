# Task 3 report — dashboard device usage client and hook

Implemented the local dashboard client and React hook for the local device usage card.

Changes:

- Added `getDeviceUsage({ from, to, timeZone, tzOffsetMinutes })` in `dashboard/src/lib/api.ts`.
  It calls the localhost-gated `tokentracker-local-device-usage` endpoint with `from`, `to`, `tz`, and `tz_offset_minutes`.
- Added `dashboard/src/hooks/use-device-usage.ts`.
  The hook fetches on mount and selection changes, uses `useLatestRequestGuard` to ignore stale responses, normalizes missing `devices`/`totals`, reports loading/errors, and exposes `refresh`.
- Added focused Vitest coverage in `dashboard/src/hooks/use-device-usage.test.tsx` for query parameters, localhost gating, loading/error behavior, range changes with stale-response protection, safe normalization, and manual refresh.

Verification:

- `npm test -- --run src/hooks/use-device-usage.test.tsx` — passed, 1 file / 6 tests.
- `npm run typecheck` — passed.

The first test invocation was blocked by the restricted environment when Vite attempted to create its temporary config file; the rerun with filesystem permission completed successfully. The working tree contains unrelated user changes, which were preserved.
