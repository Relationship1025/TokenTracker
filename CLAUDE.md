# CLAUDE.md

Guidance for Claude Code working in this repository. Every line here is loaded into every conversation turn — keep it lean and current.

## Project shape

Token Tracker (personal edition) is a local-only AI token usage tracker for the fork owner's Windows machines.

- **CLI** (`src/`, CommonJS, Node ≥20) — entry `bin/tracker.js` → `src/cli.js`. `serve` runs a local HTTP server on `:7680`, `sync` parses local AI-tool logs into `~/.tokentracker/queue.jsonl`. No cloud: no login, no upload, no telemetry.
- **Dashboard** (`dashboard/`, React 18 + Vite 7 + TS strict + Tailwind) — built to `dashboard/dist/`, served by the CLI locally. There is no hosted deployment; non-localhost hosts are unsupported.
- **Windows app** (`TokenTrackerWin/`, .NET 8 WinForms + WPF + WebView2) — system tray + floating pet + quota widget. Launches the bundled CLI `serve` on a dynamic loopback port (avoids the DoSvc-held `:7680`), hosts the dashboard in WebView2. Built `EmbeddedServer/` (Node + CLI + dashboard) is bundled by `scripts/bundle-node.ps1` so the `.exe` is self-contained. Dashboard adaptations are gated behind `isNativeWindowsApp()` (`dashboard/src/lib/native-bridge.js`).

macOS (`TokenTrackerBar/`) and Linux (`TokenTrackerLinux/`) apps, the InsForge cloud, the public site, the leaderboard, payments, and the npm release machinery were **deliberately removed** — do not reintroduce them. Multi-machine aggregation is done via the local file transfer (Settings → 数据迁移, `src/lib/local-transfer.js`).

Data flow: AI CLI runs → hook fires → `rollout.js` parses → `queue.jsonl` → local API → dashboard.

For the canonical list of supported providers, grep `parse*Incremental` in `src/lib/rollout.js` — the source of truth, not this file.

## Frequently used commands

```bash
npm test                                  # node --test test/*.test.js
node --test test/<name>.test.js           # single test file
npm run ci:local                          # tests + validations + builds
npm run dashboard:dev                     # Vite dev server with local API mock (port 5173)
npm run dashboard:build                   # build to dashboard/dist/
npm run validate:copy                     # copy registry completeness
npm run validate:ui-hardcode              # no hardcoded UI strings
npm run validate:guardrails               # architecture guardrails
node bin/tracker.js serve --no-sync       # local dashboard server on :7680
dotnet build TokenTrackerWin/TokenTrackerWin.csproj -c Release   # Windows app
```

`npm run dashboard:dev` skips the CLI backend; to verify `src/` changes use `node bin/tracker.js serve`.

## What's where

| Need to... | Look here |
|---|---|
| Add / modify a provider parser | `src/lib/rollout.js` — search `parse*Incremental` |
| Install / uninstall a provider hook | `src/lib/<provider>-hook.js` + register in `src/commands/init.js` + `uninstall.js` |
| Add a local API endpoint | `src/lib/local-api.js` — search `/functions/tokentracker-` |
| Wire a provider into sync | `src/commands/sync.js` (call site + totals aggregation) + `src/commands/status.js` (status reporting) |
| Add pricing for a model | `src/lib/pricing/curated-overrides.json` (canonical: the LiteLLM live fetch, 24h disk-cached; `seed-snapshot.json` is the day-1 offline fallback, refresh with `node scripts/build-pricing-seed.cjs`) |
| Add a dashboard page | `dashboard/src/pages/` (lazy-loaded in `App.jsx`) |
| Add UI components | `dashboard/src/ui/dashboard/components/` |
| Add a provider icon | `dashboard/src/ui/dashboard/components/ProviderIcon.jsx` (`PROVIDER_ICON_MAP` keyed by `source.toUpperCase()`) |
| Add user-facing text | `dashboard/src/content/copy.csv` — never hardcode |
| Modify tray UI | `TokenTrackerWin/TrayApplicationContext.cs` + `TrayStrings.cs` |
| Bridge native ↔ web | `dashboard/src/lib/native-bridge.js` + WebView2 postMessage in `TokenTrackerWin/DashboardWindow.cs` |
| Merge another PC's history | `src/lib/local-transfer.js` + `dashboard/src/components/settings/DataTransferSection.jsx` |

## Load-bearing conventions

### Token normalization

```
input_tokens                  = non-cached input only (no cache reads/writes)
cached_input_tokens           = cache reads
cache_creation_input_tokens   = cache writes
reasoning_output_tokens       = reasoning tokens (Codex/acode/every-code/OmO/Cline/Muse fold them into output_tokens for cost)
total_tokens                  = input + output + cache_creation + cache_read (+ reasoning_output when output excludes reasoning); Codex/acode/every-code/OmO/Cline/Muse keep reasoning as an informational subset because it is already included in output_tokens
```

**Cost is computed from `input_tokens + output_tokens + cached_input_tokens + cache_creation_input_tokens + reasoning_output_tokens` only — never `total_tokens`** (`computeRowCost` in `src/lib/pricing/index.js`). If a new provider only fills `total_tokens` with input=0/output=0, the dashboard renders **$0 cost** regardless of pricing entries. Distribute the total across columns or extend `computeRowCost`.

### Queue entry

```json
{
  "hour_start": "2026-04-05T14:00:00Z",
  "source": "claude|codex|cursor|gemini|...",
  "model": "claude-opus-4-6|gpt-5.4|...",
  "input_tokens": 0, "output_tokens": 0,
  "cached_input_tokens": 0, "cache_creation_input_tokens": 0,
  "reasoning_output_tokens": 0,
  "total_tokens": 0, "conversation_count": 1
}
```

UTC, half-hour buckets, append-only — readers take the latest entry per `(source, model, hour_start)`. `queue.state.json`'s `offset` is legacy upload-cursor bookkeeping: some repair flows still reset it; nothing reads it for uploading anymore.

### Project-wide

- CommonJS in `src/`, ESM + TypeScript strict in `dashboard/`. No mixing.
- Env-var prefixes: `TOKENTRACKER_` for CLI, `VITE_` for dashboard.
- Git commits in **English**, conventional style (`feat:` / `fix:` / `refactor:` / `chore:` / `docs:` / `test:`).
- **Privacy**: token counts only — never prompts, messages, or conversation bodies.
- `TokenTrackerWin/EmbeddedServer/` is gitignored; built on demand by `TokenTrackerWin/scripts/bundle-node.ps1`.
- Versions live in exactly two places: `package.json` (source of truth) and `TokenTrackerWin/TokenTrackerWin.csproj` (`npm run sync-versions` / `validate:versions`).
- Local-transfer snapshots have a strict field allowlist + SHA-256 content hash; the local origin is excluded from merged aggregation to prevent double-counting re-imported history.

## Parser correctness (from upstream — still applies)

- **Parser dedup**: use `claudeMessageDedupKey()`. Bare `if (msgId && reqId)` fails open on DeepSeek/Kimi/Mimo/MiniMax/Claude sub-agents (no `reqId`) and over-counts 1.6–3.7×.
- **Don't trust `input_tokens` semantics blindly** when adding a new provider. Codex/every-code's `input` includes cached tokens — naive copy inflates cost 6–7×. Verify with raw usage + provider billing dashboard before shipping.
- **`contextTokensUsed`-style fields are usually snapshots, not cumulative.**
- **Mimo (mimocode) mirrors your Claude Code + claude-mem history into its own DB.** `readMimoDbMessages()` keys off `providerID`: keep only `mimo`/`xiaomi` (mimo's own runtime); drop everything `anthropic`. Do NOT key off the model id and do NOT rely on `claude_import`.
- **Data-migration releases**: stress-test `sync` twice consecutively after touching `sync.js` / cursor schema — second run exposes state pollution the first hides.

## Lessons learned (dashboard / Windows)

- **`AppLayout`-wrapped pages use `flex flex-col flex-1`** as the outer wrapper, not `min-h-screen` + own sticky header/footer.
- **Motion height animations clip box-shadow focus rings.** Use `focus:ring-inset` on inputs inside `AnimatePresence` height-collapsing containers (see the Settings page's collapsing sections).
- **Dashboard pages are lazy-loaded in `App.jsx`** — keep the null-fallback `.catch(() => ({ default: nullComponent }))` pattern so a stale index.html with rotated chunk hashes degrades to a blank region instead of a blank app.
- **The Windows tray owns native settings push**: `PushDashboardNativeSettings` mirrors launchAtLogin/isSyncing/version into the WebView; add new native settings there + in `use-native-settings.js`, not via new endpoints.
- **WebView2 disposal races**: `DispatcherExceptionPolicy.Classify` decides between absorb / recreate-WebView / crash. Never swallow unknown dispatcher exceptions silently.

### False-positive validators to ignore

- `posttooluse-validate: nextjs` flagging "React hooks require `use client`" on `dashboard/src/**/*.jsx` — this is a **Vite SPA**, not Next.js.
- `posttooluse-validate: workflow` flagging `require()` in `.github/workflows/*.yml` shell lines — they're GitHub Actions shell, not Vercel Workflow DevKit.

### Working with subagents

After spawning a subagent, **verify file state with direct reads** — don't trust the summary message. Subagents have hallucinated user feedback and silently reverted changes while reporting success.
