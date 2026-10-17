# Local Data Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe file-based token usage export/import for combining several personal computers on a primary computer.

**Architecture:** The CLI creates and stores complete per-computer usage snapshots in a private `imports/` directory. The local API keeps those snapshots separate from the parser queue and merges accepted rows only when serving dashboard usage endpoints. The dashboard adds a settings panel that downloads the local snapshot, previews a selected file, imports it atomically, and can undo the last replacement.

**Tech Stack:** Node 20+ CommonJS CLI, existing local HTTP API, React 18/Vite dashboard, Node test runner, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-local-data-transfer-design.md`

## Global Constraints

- Preserve privacy: transfer files contain token metrics only and never prompt, response, code, path, credential, or cursor data.
- Keep the local queue append-only and do not alter `queue.state.json`, `cursors.json`, or cloud upload offsets during import.
- Use `source|model|hour_start` as the bucket identity inside each origin; combine different origins by summing numeric usage metrics.
- Exclude imported `cursor` and `trae-cn` rows from combined totals and disclose the policy in the UI.
- Use English conventional commits if commits are created.

---

### Task 1: Snapshot domain and merge rules

**Files:**
- Create: `src/lib/local-transfer.js`
- Create: `test/local-transfer.test.js`

**Interfaces:**
- `createSnapshot({ rows, originId, originName, generationId, revision, appVersion, exportedAt })`
- `validateSnapshot(value)`
- `mergeTransferredRows(localRows, snapshots)`
- `summarizeSnapshot(snapshot)`

- [ ] Write failing tests for validation, revision replacement, duplicate import semantics, zero-value replacement, two-origin summation, account-source exclusion, and undo metadata.
- [ ] Run `node --test test/local-transfer.test.js` and confirm failure because the module does not exist.
- [ ] Implement the pure snapshot and merge functions with explicit numeric allowlists and SHA-256 content hashing.
- [ ] Run the focused test until all cases pass.
- [ ] Commit `feat: add local usage transfer snapshot rules`.

### Task 2: Local API transfer endpoints and storage

**Files:**
- Modify: `src/lib/local-api.js`
- Modify: `test/local-api-source-scope.test.js` or create `test/local-api-local-transfer.test.js`

**Interfaces:**
- `GET /api/local-transfer/export?name=<optional>` returns a validated JSON snapshot for the current local queue.
- `POST /api/local-transfer/preview` accepts `{ snapshot }` and returns a summary plus action (`new`, `replace`, `noop`, `stale`, or `conflict`).
- `POST /api/local-transfer/import` accepts `{ snapshot }` and atomically stores the accepted origin snapshot.
- `POST /api/local-transfer/undo` restores the previous snapshot or removes the last imported origin.

- [ ] Write failing endpoint tests for local auth, export isolation, preview actions, atomic import, undo, and merged usage totals.
- [ ] Run the focused endpoint tests and confirm failure.
- [ ] Add storage under `<trackerDir>/imports/`, revision/generation state, bounded request parsing, and local-auth checks.
- [ ] Replace dashboard read paths with merged queue rows while keeping sync and export local-only.
- [ ] Run endpoint tests and the existing local API tests.
- [ ] Commit `feat: expose local usage transfer through the local api`.

### Task 3: Dashboard data transfer settings

**Files:**
- Create: `dashboard/src/components/settings/DataTransferSection.jsx`
- Modify: `dashboard/src/pages/SettingsPage.jsx`
- Modify: `dashboard/src/content/copy.csv`
- Create: `dashboard/src/components/settings/DataTransferSection.test.jsx`

**Interfaces:**
- The panel requests local-auth headers, downloads JSON, previews a selected file before import, shows source/date/row/token summary, and offers undo after a successful import.

- [ ] Write failing Vitest tests for rendering, file preview, import confirmation, account-source warning, and undo.
- [ ] Run the focused dashboard test and confirm failure.
- [ ] Implement the settings section with existing `Button`, `SectionCard`, copy registry, and browser download APIs.
- [ ] Run the focused dashboard test, copy validation, and dashboard build.
- [ ] Commit `feat: add local usage transfer settings`.

### Task 4: Whole-branch verification

**Files:**
- No new production files.

- [ ] Run `node --test test/local-transfer.test.js test/local-api-local-transfer.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm --prefix dashboard test -- --runInBand` or the repository-supported Vitest command.
- [ ] Run `npm run validate:copy`, `npm run validate:ui-hardcode`, and `npm run dashboard:build`.
- [ ] Review the diff for privacy leaks, imported data loops, and missing copy keys.
