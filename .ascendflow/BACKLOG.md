# Ascend Backlog

Deferred features and initiatives that have been explicitly scoped but not yet implemented. When you want to pick one up, run `/ax:plan <slug>` to create a full PRD + TASKS.md.

Last updated: 18. 5. 2026

---

## Ascend CLI (@ascend/cli) — SHIPPED 18. 5. 2026

v0.1.0 ships a 9-command CLI as the third surface alongside the web UI and the MCP server. Lives at `packages/cli/`, distributed as the `ascend` binary. Built across 8 phases (commits `00f309e` → `d11bb32`). Tsup-bundled ESM, Node 22+, ~77 KB dist size.

Commands shipped:
- **Auth:** `login` (interactive or flag-only), `logout` (with `-y`), `whoami` (with `--json`, `--refresh`).
- **Headline:** `today` / `dashboard` — 4-section morning view (Big 3, agenda, weekly focus, streaks + XP).
- **Todos:** `todo add | list | done | big3 [set]` — natural-language `--due`, status icons, ★ prefix for Big 3, prefix-to-id resolution.
- **Goals:** `goal list | show | progress` — unicode progress bars, SMART fields in detail view.
- **Context:** `context search | add | get` — hybrid + text + semantic search modes, `--stdin` support, link-aware detail panel.
- **Calendar:** `calendar day | week | agenda` — Monday-first 7-column grid, hourly day timeline, flat agenda.
- **MCP escape hatch:** `mcp list-tools [--filter]` (86+ native + federated tools), `mcp call <tool> [args]` (inline / `--args-file` / `--stdin`).
- **Browser:** `open [route] [--print]` — no-auth required (resolves base URL only).

Output: pretty / `--json` / `--md` on every command. NO_COLOR honored. Exit codes documented (1 usage, 2 api, 3 network).

Audits at close: `ascend-reviewer` **PASS WITH NOTES** (3 stylistic notes, 2 addressed in `d11bb32`, 1 deferred). `ascend-critic` **GOOD** (2 must-fix, both addressed in `d11bb32`).

### Ascend CLI carry-overs (v0.2 target)
- **Server-side `--limit` on todo + goal list.** `todoFiltersSchema` and `goalFiltersSchema` in `packages/core/src/schemas/` do not include a `limit` field. The CLI currently client-side-slices after downloading the full list. For users with hundreds of todos this is wasteful. Add `limit: z.coerce.number().int().min(1).max(200).optional()` to both schemas, plumb through the service `take` parameter, and pass `?limit=N` from the CLI.
- **Shell completions** (`zsh`, `bash`, `fish`). Commander supports this via `commander-completion` or a custom `.createHelp()` extension. 6 namespaces × 20+ leaf commands deserve tab completion.
- **`--sort` flag on list commands.** Every backend list endpoint already orderBy's. Expose `--sort created | updated | priority | due` on `todo list` and `goal list` at parity with `gh issue list --sort`.
- **`calendar week` adapts to terminal width.** Currently `colWidths: 20 × 7 = 140 chars` overflows narrow terminals. Read `process.stdout.columns` and shrink columns / fall back to a stacked layout under 120 cols.
- **`--verbose` / `--debug` flag.** Dump request/response bodies, headers, timing to stderr. Drop-in equivalent of `gh --verbose` / `stripe --debug`.
- **Interactive Big 3 picker.** `ascend todo big3 set` currently requires copy-pasting ids from the previous `todo list` output. An `@inquirer/prompts` checkbox picker would be much more ergonomic, only on the interactive path; keep the explicit-id form for scripts.
- **`context add` content-optional.** Currently requires `--content` or `--stdin`. `gh issue create -t "Bug"` ships title-only; mirror that.
- **`ascend` with no args shows version inline.** Top of `--help` should include `Ascend CLI v0.1.0` so users know what they're running without running `--version`.
- **Tag-triggered npm publish.** v0.1.0 ships via manual `pnpm publish --filter @ascend/cli`. A GitHub Actions workflow keyed on `cli-v*` tags would automate the release once NPM_TOKEN is configured in repo secrets.
- **Server-side prefix search.** `goal show <prefix>` and `context get <prefix>` currently download the full list to resolve the prefix. A server-side endpoint (`GET /api/goals?idPrefix=abc`) would be O(1) instead of O(N).
- **Telemetry (opt-in only).** Anonymous command counts / error rates could help prioritize v0.2. Must be opt-in, must be off-by-default, must be a single switchable env var.

---

## Wave 9 (Spatial canvas) — INFRASTRUCTURE SHIPPED 14. 5. 2026, REAL CLOSE 17. 5. 2026

The 14. 5. close shipped infrastructure but never ran the closing manual smoke or `ascend-critic`. Step 1 of the smoke ("open `/context` → click Map") would have caught immediately that **the Map view crashed on production with "Maximum update depth exceeded"** from Excalidraw's internal tunnel-rat `useSyncExternalStore` loop. Wave 9 was silently broken on prod from 14. 5. → 17. 5. 2026.

17. 5. close (real) shipped:

- **Crash fix** — `onSceneChange` + `excalidrawAPI` had a new function identity every render. Stable ref-pattern wrappers in `context-canvas-view.tsx` solve it (`stableOnSceneChange` + `stableExcalidrawAPI`). Documented as DZ-27 in CLAUDE.md with inline comments at the fix site.
- **Must-fix items from 15. 5. `ascend-critic` NEEDS WORK verdict** all shipped: card drag (`locked: false` + rAF live position tracking), card click → detail `<Sheet>` (`selectedEntryId` + `ContextEntryDetail`), `+ Add card` toolbar picker (`CanvasAddCardDialog` with search + keyboard nav + pan-to-existing + viewport-center placement).
- **Should-fix copy + polish** — empty state points to "+ Add card", "Edges" → "Connections", "Deleted layout" → "Layout removed", view-switcher tooltips, dot-grid loading skeleton, `COMPONENT_CATALOG.md` gains 17-entry Wave 9 section (total 87 → 104 components).
- **Defense in depth** — `sanitizeAppStateForPersist` strips 19 Map/Set/transient appState keys, `rehydrateAppStateForExcalidraw` rebuilds Map+Set on restore, `CanvasViewErrorBoundary` auto-resets `useUIStore.contextActiveView` to `"list"` on render failure (eliminates "permanently locked out of /context" footgun).
- **Diagnostic scaffolding kept in tree** — exported `ContextCanvasViewMounted` + optional `CanvasBisectionFlags` (13 flags, all default off), `/test-canvas-full` page mounts the full tree with fake QueryClient + Zustand state and URL-flag bisection, `/test-canvas` retained as bare-Excalidraw regression baseline.

`ax:verify-ui` PASS WITH NOTES (7/7 scenarios), `ax:critique` verdict moved NEEDS WORK → **GOOD**. Wave 9 success criteria C11 (card movement), C12 (click-to-open-detail), C13 (critic verdict) now DONE. Commits: `0cc09d8` (fix), `b15168a` (docs).

### Wave 9 original close (14. 5. 2026)

The Map view ships an infinite Excalidraw canvas with persistent per-layout node positions, drag-from-sidebar card creation, debounced autosave with status pill, edge rendering + draw-to-create-link with an 8-option type picker, multiple named layouts with switcher + rename + delete, `.excalidraw` import (replace/merge) + export, 3 MCP tools (count 76 → 79), and activity feed integration for 4 new event types.

Schema added 2 tables + 1 enum extension across 4 hand-written migrations (all DZ-2 safe, additive, search_vector intact). Service layer added `canvas-layout-service`, `canvas-node-service`, `canvas-import-service`. 7 API endpoints under `/api/canvas/`. Excalidraw v0.18.1 (MIT, React 19 supported as of 0.18.0). `.tldr` import was dropped in the Phase 0 spike: no maintained standalone parser exists.

Audit verdicts: `ascend-migration-auditor` PASS (Phase 1, 4 migrations clean), `ascend-reviewer` PASS post-fix (Phase 2, 3 permission-action fixes WRITE_NODE → DELETE_NODE on delete paths), `ascend-security` PASS (Phase 3, zero findings on the 5 route files). Phase 0 perf measurement was deferred at the spike: the spike page had layout-math bugs that weren't worth iterating on prod for; the real card-overlay perf rides on the live canvas via Phase 5+.

Commits: `a56d68f` (Phase 0 install + spike), `071fcb4` (Phase 0 close), `14fead2` (Phase 1 schema), `5c6a84e` (Phase 2 services), `f5be38a` (Phase 3 routes + hooks), `ae5bc31` (Phase 4 Map mount + empty state), `1abc185` (Phase 5 cards + drag + autosave), `81e989c` (Phase 6 edges + type picker), `5958893` (Phase 7 layout switcher), `123752d` (Phase 8 import + export), `a8c2eb9` (Phase 9 MCP tools), `7f48e6d` (Phase 10 activity events + confetti), wave-close commit. Close-out at `.ascendflow/features/context-v2/wave-9-spatial-canvas/CLOSE-OUT.md`.

## Wave 9 carry-overs

### MEDIUM (polish that didn't make the wave)

- **Per-card-size toggle in the toolbar.** The Zustand viewport stores `cardSize` (compact / default / expanded) and the overlay renders all three regimes already; Phase 7 deferred the toggle button itself.
- **Card hover affordance for edge preview.** When edges are off, hovering a card should briefly fade in its outgoing arrows. The Phase 10 task spec had this; deferred for time.
- ~~**Click-to-open-entry-detail wiring on cards.**~~ SHIPPED 17. 5. 2026 as Wave 9 close must-fix #2. `onCardClick` now opens a right-side `<Sheet>` with `ContextEntryDetail` (full content + version history + click-to-edit), selection ring on card while Sheet is open, Escape closes.
- **Optimistic delete-via-keyboard-Delete on selected cards.** Excalidraw's native Delete key removes the rectangle from the scene; we need to also fire `useRemoveNode` so the CanvasNode row goes away. Currently the rect disappears but the DB row lingers until manual sidebar removal.

### LOW (Wave 9 PRD "Out of Scope")

- **Realtime collaborative canvas.** Wave 9 ships single-user / last-write-wins; Yjs binding to Excalidraw's scene format is real engineering. Defer until multi-user demand surfaces.
- **Per-canvas time travel.** Adding `CanvasLayout` / `CanvasNode` to the Wave 7 NodeVersion polymorphic table. Defer.
- **Mobile canvas.** Excalidraw on touch is functional but not great; Wave 6 (when shipped) will ship a read-only Map thumbnail with full editing in a later polish wave.
- **Embedded canvases inside notes.** EmbedNode Lexical placeholder remains a stub.
- **AI-generated layouts.** "Lay out my workspace as a graph" via LLM. Adds prompt + token cost considerations.
- **Per-link annotations on the canvas.** Sticky notes attached to an arrow with persistence.
- **Snap-to-grid / alignment guides.** Excalidraw has none natively.
- **Layout sharing / public publishing.** Wave 8b carryover covers this for all entity types.
- **`.tldr` import revisit.** If a community-maintained standalone parser emerges, reopen.

---

## Wave 8 (Workspaces + collaboration foundation) — SHIPPED 13. 5. 2026

Multi-tenant substrate + real-time editing foundation shipped across 11 phase commits + 2 Phase-4 hotfixes + 1 close-out fix on `main`. The Workspace + WorkspaceMembership + ActivityEvent tables landed in Phase 1 (2 migrations, idempotent). Phase 2 added `workspaceId String` (NOT NULL after backfill) to every entity table (18 tables, 2 migrations gated by a pre-flight NULL-count check). Phase 3a introduced workspaceService, workspaceMembershipService, workspaceContextService, permissionService and extended the auth flow with `currentWorkspaceId` on the JWT. Phase 3b mass-refactored every service method + every API route + every MCP handler to take `(userId, workspaceId, ...)`. Phase 4 deployed a standalone Hocuspocus CRDT server (`apps/crdt/`) to `crdt.ascend.nativeai.agency` with JWT-protected token issuance + server-to-server persist endpoint. Phase 5 wired the Lexical block editor to the live server via `@lexical/react`'s stable `CollaborationPlugin`. Phase 6 added presence avatars + collaborative cursors via Yjs awareness. Phase 7 added an activity feed at `/activity` with cursor pagination + filters; 8 services fire-and-forget log to ActivityEvent. Phase 8 surfaced the workspace switcher in the sidebar and the `/settings/workspace` page. Phase 9 added 3 MCP workspace tools, bringing the count to 76.

Two production incidents during the wave: a wget-based Docker HEALTHCHECK that failed because `node:22-alpine` lacks wget (fixed in `408f456`), and a pnpm `.pnpm` content-addressable store that wasn't copied to the runner stage, causing `ERR_MODULE_NOT_FOUND` on `@hocuspocus/server` (fixed in `c684c35`). Both were caught and resolved during prod verification; the second was the actual root cause of the initial CRDT 502s. One DNS incident during smoke testing: the user's `ascend` GoDaddy A record got accidentally replaced when adding `crdt.ascend`; restored mid-session. Commits: `75abf6e`, `baf7ef8`, `006a8ec`, `f7d05e8`, `cf72972`, `408f456`, `c684c35`, `fb43f3e`, `fd0a136`, `eda338b`, `698afc9`, `5c2f375`, `ea2ba04`, plus the wave-close commit. Close-out at `.ascendflow/features/context-v2/wave-8-workspaces-and-collaboration/CLOSE-OUT.md`.

## Wave 8 carry-overs (tracked here until picked up by Wave 8b)

### HIGH (prerequisite for multi-user)

- **Deep-linking infrastructure.** Activity feed entity links currently land on the domain page (`/context`, `/goals`, `/todos`) without selecting the specific entity. Every entity page needs URL-param-based direct navigation. Critic flagged this as Wave 8b priority #1 because it unblocks not just the activity feed but also browser history, link sharing, and mobile deep links.
- **`LINK_CREATED` / `LINK_REMOVED` event titles.** Renderer currently shows generic "entry to entry"; payload carries `fromEntryId` + `toEntryId` but the row should fetch + display the actual titles.
- **Activity feed mobile filter affordance.** Filter sidebar is `hidden md:block`; add a sheet / drawer trigger for mobile.
- ~~**`CRDT_PERSIST_SECRET` minimum length guard.**~~ SHIPPED. `apps/crdt/src/persist.ts:25-31` throws on startup if <32 chars. `apps/web/lib/auth.ts:213-218` logs warning + returns false on persist requests if <32 chars. Both sides enforce the 32-char floor at module load + at every persist request.
- ~~**MCP CORS allowlist.**~~ SHIPPED. `apps/web/app/api/mcp/route.ts:6-66` reads comma-separated `MCP_ALLOWED_ORIGINS` env var; when set, echoes back matching request `Origin` with `Vary: Origin`; when unset, defaults to wildcard with a console.warn at module load. Production: set `MCP_ALLOWED_ORIGINS=https://ascend.nativeai.agency,https://claude.ai` in Dokploy env.
- **Membership revocation should clear access tokens.** `_resolveWorkspaceId` (`apps/web/lib/auth.ts:101-107`) trusts the JWT claim without re-checking membership. In Wave 8b, removing a user from a workspace should revoke their access token immediately (currently they retain access until next JWT refresh, up to 15 min). Implementation options: (a) per-request DB round-trip to verify `ACTIVE` membership (~5-10ms overhead per authenticated request), (b) invalidate refresh tokens on member removal so next refresh fails, (c) shorten access JWT TTL from 15min to 5min to bound the staleness window. (b) is the most accurate; (c) is the simplest. Defer until multi-user.

### MEDIUM (Wave 8b features and enrichment)

- **Invite flow.** Wave 8 ships the data model + disabled UI; Wave 8b implements the email, accept-link, and role-assignment flow.
- **Multi-member workspaces and second-user UX.** The schema supports it; the UI is single-user today.
- **Per-node permission overrides** (private to me / shared with X / open to workspace).
- **Branching merge UI.** Wave 7 created the DERIVED_FROM substrate; Wave 8 deferred the merge flow.
- **Public publishing.** No `(public)` route group, no `/public/<workspaceSlug>/<pageSlug>` endpoint, no reader-mode renderer, no password gating, no sitemap.
- **Comments + threads anchored to block IDs.**
- **`@mentions` + notification fanout.**
- **In-app + email notifications.** No Notification table, no email infrastructure today.
- **NODE_UPDATED in the activity feed.** Currently only create/delete/restore/branch fire; edit events are the most frequent user action and would make the feed more useful.
- **Jump-to-cursor for presence.** Click a presence avatar to scroll the editor to that user's cursor. Essential for actual collaboration.
- **Rate limiting on `/api/crdt/token`.** Currently unlimited; a compromised API key could request tokens at high volume. Add the login route's in-process rate limiter pattern.
- **`User.role` admin routes** (carried over from Waves 4 + 7; still pending).

### LOW (post-close polish)

- ~~**Connection indicator copy.**~~ ALREADY SHIPPED. `context-block-editor.tsx:422` reads "Saving locally" in the fallback state. BACKLOG entry was stale.
- **Workspace switcher behavior with a single workspace.** Currently shown as a disabled dropdown row with a check mark. Notion and Linear hide the switcher entirely for single-workspace accounts; either approach is defensible.
- ~~**Secret distinctness check at startup.**~~ SHIPPED 17. 5. 2026. `apps/web/lib/services/workspace-context-service.ts` runs a module-load assertion that throws if any pair of `AUTH_JWT_SECRET`, `CRDT_JWT_SECRET`, `CRDT_PERSIST_SECRET` share the same string. Pairs are only checked when both are set; missing secrets surface their own clearer errors at call sites.
- **Goal completion should fire NODE_UPDATED.** `goalService.completeWithSideEffects` does not log to ActivityEvent today; the feed misses goal completions.
- **`useUpdateGoal` invalidation.** Does not invalidate `queryKeys.activity.all()`; once goal updates log activity, the hook needs to invalidate.

### Wave 7 carry-overs (no change)

Wave 7 carryovers remain as previously tracked. The MEDIUM tier items (User.role admin routes, per-user retention customization, time slider beyond 90 days, edge history viewer, cron slot staggering, retention compactor full-history memory, graph snapshot replay memory) are still open and have largely overlap with Wave 8b's hardening goals.

---

## Wave 7 (Provenance + time travel) — SHIPPED 5. 5. 2026

Full provenance system shipped across 13 commits (11 phase commits + 2 production incident fixes). Every node-shaped entity (ContextEntry, Goal, Todo, DatabaseRow, DatabaseField) is now snapshotted to an append-only `NodeVersion` table with a 60s debounced trigger pattern that fires on every qualifying mutation. Every ContextLink mutation is logged to `EdgeEvent`. A pure-TS diff engine (`@ascend/diff` shared package) provides 4 type-aware diff strategies with 10/10 fixture tests. The UI includes a collapsible version history panel mounted in 4 detail panels, a full-screen diff modal with type-aware renderers, restore and branch actions, and a 90-day time slider on the graph view backed by precomputed `GraphDailySnapshot` rows. 5 new MCP tools bring the total from 68 to 73. Two nightly cron workflows handle retention compaction (03:00 UTC) and graph snapshot precomputation (03:30 UTC). A one-shot backfill script creates v1 snapshots for all existing entities. The `DERIVED_FROM` ContextLinkType enables branching with cycle detection (100-hop walk) and a 50-derivative hard cap.

Two production incidents during the wave: a Dockerfile missing the `packages/diff` COPY stage (fixed in `59c76a4`), and a Next.js param collision between `GET /api/versions/[nodeType]/[nodeId]` and `GET /api/versions/[id]` that required renaming the single-version route to `/api/versions/by-id/[id]` (fixed in `7890113`). Both were caught and resolved before deployment. Commits: `279fe9e`, `6dd2121`, `c24c816`, `6bc0aae`, `d834431`, `abbe99d`, `59c76a4`, `04edcbd`, `7890113`, `0dfc073`, `7ccdd33`, `ae9a964`, `02ed232`, plus the wave-close commit. Close-out at `.ascendflow/features/context-v2/wave-7-provenance-and-time-travel/CLOSE-OUT.md`.

## Wave 7 carry-overs (tracked here until picked up)

### MEDIUM (should land before Wave 8 multi-user)

- **`User.role` admin-only routes.** Still pending from Wave 4 backlog. Wave 7 added 2 more cron-secret routes; the admin-only-via-JWT pattern remains unimplemented.
- **Per-user retention customization.** Retention policy is hardcoded at 30d all / 30d 1/day / forever 1/week (Monday-anchored). Surfacing this in `/settings` with per-user overrides is deferred.
- **Time slider beyond 90 days.** The slider is hard-capped at 90 days. Lifting it requires extending the precompute backfill window and potentially a historical backfill endpoint.
- **Edge history viewer.** EdgeEvents are stored and queryable but no dedicated UI exists. The graph time slider implicitly visualizes edge history through daily snapshots, but per-edge history browsing is deferred.
- **Cron slot staggering.** Retention compactor and map-refresh both run at 03:00 UTC. Non-issue for single-user production (both complete quickly), but should be staggered if multi-user concurrency grows.
- **retention-compactor full-history-load memory pattern.** `compactUserVersions` loads all versions per (nodeType, nodeId) into memory before computing the keep-set. For thousands of versions on a single node this could spike memory. Not relevant at current scale; plan cursor-based chunking before Wave 8.
- **graph-snapshot replay loads all EdgeEvents up to cutoff into memory.** The `precomputeDailySnapshot` method replays edge events in-memory. Adequate under cron-secret gate for single-user; cursor-based replay before Wave 8 multi-user.

### LOW (UX polish)

- **Field labels in field-diff-renderer use camelCase keys.** Should humanize them (e.g., `startDate` → "Start date") for a more polished diff view.
- **DERIVED_FROM derivative count fetched on BranchDialog open.** Currently passes 0 to the dialog; the soft warning (> 5 derivatives) is suppressed. Fetch actual count or pass from parent.
- **Cascade-delete tombstone snapshots for child goals.** Currently only the deleted root goal gets a tombstone snapshot. Child goals deleted via cascade are not snapshotted.
- **Restore wraps unexpected errors with generic message.** Currently can leak Prisma constraint field names to the client in error messages. Non-critical for single-user, should wrap before multi-user.
- **Rate limiting on Wave 7 routes.** None of the 5 user-facing routes have rate limiting. Wave 8 multi-user work.
- **GraphDailySnapshot backfill for dates older than the cron has covered.** If the cron has only been running for 3 days, the slider shows "snapshot not yet computed" for day 4 and earlier. Falls back gracefully but is not ideal.
- **Three-pane desktop diff view.** The PRD specified left/center/right on wide viewports. Phase 8 implemented single-column tabbed for readability. Design decision, not a bug, but the three-pane approach may be revisited.

### Notion/Airtable parity items deferred

- **Merging branches.** Branching is one-way in Wave 7. Merge UI + three-way diff merge tooling is Wave 8 collaboration territory.
- **Real-time collaboration on a single document.** Wave 8.
- **Search across versions.** "Find a note that mentioned X last quarter" requires a separate full-text index over historical payloads.
- **Time slider on non-graph views.** Calendar, Table, Board, Gallery, Timeline views remain live-only. Future polish.

---

## Wave 5 (Databases + properties) — SHIPPED 4. 5. 2026

Notion-grade databases shipped end to end with no scope deferral per the user's "do everything, do not deffer" mandate. 14 field types (TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, RELATION, FORMULA, USER, CHECKBOX, RATING, URL, EMAIL, PHONE, FILE), 5 view types (Table via TanStack Table + Virtual; Board kanban via @dnd-kit; Calendar month grid via @dnd-kit; Gallery responsive grid; Timeline gantt via @dnd-kit + raw pointer events for edge resize), full formula engine (1890 LOC, 28/28 fixtures), many-to-many relations through the existing ContextLink graph (DATABASE_RELATION typed edge), Notion-style filter builder (recursive AND/OR groups, depth-capped at 5), sort builder, 4-tab view config popover (Filter, Sort, Properties, Layout), inline cell editing, change-type dialog with force-conversion flow, row detail integration (each row IS a ContextEntry of type RECORD with its own BlockDocument body), backlinks panel, slash menu Database item, /context "New" dropdown with Database option, view-switch micro-interaction (motion-safe fade-slide), confetti on database creation, 10 new MCP tools (count 58 → 68). New danger zones DZ-14 (formula CPU/memory), DZ-15 (JSONB property bloat), DZ-16 (RELATION cascade explosion) all mitigated. Commits: `13106a8`, `b88800c`, `c58aa53`, `70320c8`, `aad5184`, `df1f7c0`, `e7ea93c`, `187771d`, `9d009f5`, `b88d9c7`, `ddc6f50`, `765c778`, `3d8f3f0`, plus the wave-close commit. Close-out at `.ascendflow/features/context-v2/wave-5-databases-and-properties/CLOSE-OUT.md`.

## Wave 5 carry-overs (tracked here until picked up)

### LOW

- Tab key advances cell-to-cell in Table view (Notion-style spreadsheet ergonomics). Currently Enter commits and closes; Tab does not move focus to the next cell.
- Calendar chips and Gallery cards are click-only; no `tabIndex` + arrow-key navigation. Accessibility gap.
- View config popover "Options" button shows aggregate count but doesn't differentiate filter vs. sort vs. hidden-field counts.
- Timeline bars at very small durations (zoom × duration < edge-handle width) overlap edge handles. Add a minimum-width guard.
- Error toasts in Board/Calendar/Timeline drag handlers surface raw `err.message`; should wrap in a human-readable formatter.
- First-row-created confetti (was deferred from the close-fix scope; database-creation confetti shipped).
- View-switch animation is fade-slide only; no spring/bounce variants per view type. Polish item.
- Relation editor in Table cells uses naive entry search (`/api/context/search?q=...`); no scope-narrowing to the target database when `field.config.targetDatabaseId` is set. Functional, but unnecessarily broad.
- Migration `20260502120002_create_database_models` does not use `IF NOT EXISTS` on `CREATE TYPE` and `CREATE TABLE` statements (Prisma's tracker handles re-execution; defense-in-depth gap, not a real failure mode).

### MEDIUM (should land before Wave 8 multi-user)

- **Type-change UI for non-allowed coercions.** Currently the dialog supports TEXT → URL/EMAIL/PHONE, NUMBER → TEXT, SELECT → MULTI_SELECT only. Other coercions return "Unsupported type change. Delete and recreate." A future pass should support more (DATE → TEXT, MULTI_SELECT → TEXT comma-joined, etc.).
- `databaseFieldService.cycleCheck` does not include `userId` in its query (called only after upstream ownership verification). Defense-in-depth gap.
- `databaseQueryService.query` falls back to in-memory filter + sort for FORMULA-targeted clauses, capped at 10k rows. At scale, this is a perf cliff. Plan: materialized formula values OR computed columns.
- Three of the new routes (`by-entry`, `relation-backlinks`, `row-by-entry`) import `validateApiKey` while the rest use `authenticate` (alias). Standardize.

### Notion / Airtable parity items deferred to a future polish wave

- **Rollups.** Aggregate property: sum/avg/min/max/count of a relation's property.
- **Synced/duplicated databases** across pages (Wave 8 multi-workspace territory).
- **Database templates / starter schemas** (CRM, reading list, expense ledger).
- **CSV/XLSX import / export.**
- **External integrations** (Notion API, Airtable API, Google Sheets sync).
- **Database-level permissions** (per-row visibility rules, per-view sharing). Wave 8.
- **Aggregations in the table footer** (sum/count/avg row).
- **OpenGraph image fetch** for URL covers in Gallery view (currently shows the URL text inside a styled box).

### Stubs left in code (should be cleared before next wave)

- None. The wave-close session deliberately closed all critic-flagged stubs (type-change UI, relation autocomplete in Table cells, view-switch animation, database-created confetti).

---

## Wave 4 (Universal Files) — SHIPPED 2. 5. 2026

Drop-zone overlay + Upload button on `/context`, MIME-aware extraction pipeline (PDF / image / audio / video / spreadsheet / plain-text) with Postgres-backed queue (`ExtractionJob`, SELECT FOR UPDATE SKIP LOCKED, retry up to 3 with exponential backoff, per-user daily cap of 50). 6 new API routes (`/api/files/[id]`, `/status`, `/extract`, `extract/run`, `cleanup`, plus extended `presign`/`confirm`). 3 new MCP tools: `upload_file`, `get_file_content`, `list_files_by_type` (tool count 55 → 58). File blocks fully implemented in the Lexical editor: `FileBlock` MIME-dispatch wrapper, `PdfPreview` (sandboxed iframe), `ImageBlock` (lightbox + arrow-key nav + zoom), `AudioPlayer`/`VideoPlayer` (transcript collapse), `SpreadsheetPreview` (5×5 inline table), generic `FileCard`. Slash menu items `/upload`, `/file`, `/image`, `/pdf`, `/audio`, `/video`. Two GitHub Actions cron workflows: file-extraction-tick (every 5 min) and file-cleanup (daily 04:00 UTC). DZ-11 resolved (URLs via `/api/files/[id]`, sandboxed PDF iframes, SVG attachment + nosniff). New DZ-12 (extraction queue runaway, fully mitigated) and DZ-13 (R2 orphan in `uploadBytes`, low-risk, deferred). Commits: `632528a`, `7f99c9c`, `b0d67ca`, `b5a3637`, `fc6c42e`, `29ae8cd`. Close-out at `.ascendflow/features/context-v2/wave-4-universal-files/CLOSE-OUT.md`.

## Wave 4 carry-overs (tracked here until picked up)

### LOW

- Strip `storageKey` / `bucket` from API responses (pre-existing pre-Wave 4).
- SVG GET response could add `filename=` parameter and CSP `sandbox` directive.
- Explicit 400 on `createEntry` + `entryId` combo in `POST /api/files/presign` (currently silently picks `createEntry`).
- CUID format validation on `[id]` path params (defense-in-depth).
- Rename `error` field in `get_file_content` response to `extractionErrorMessage` for clarity.
- `audio-player.tsx` / `video-player.tsx`: timestamp-linked transcript click-seek deferred (no schema field for word-level Whisper timestamps).
- Migration `20260427000001/migration.sql:58` `ALTER TABLE ADD CONSTRAINT` lacks `IF NOT EXISTS` guard. Safe (Prisma tracks state) but inconsistent with the file's "IDEMPOTENT" comment.
- Image alt-text inline editing (currently displayed but not editable from the block).
- Image presigned URL refresh on visibility change (current 5-min URL can expire mid-session).
- Drag-drop discoverability hint in the `/context` empty state.
- Unify lightbox UX between `FileBlockImage` (simple open/close) and `ImageBlock` (arrow-key nav + zoom).

### MEDIUM (should land before Wave 8 multi-user)

- Extract `verifyCronSecret` into a shared helper in `lib/auth.ts` (currently duplicated across `context/map/refresh`, `files/extract/run`, `files/cleanup`).
- Restrict `POST /api/files/extract/run` JWT path to admin-only (currently any authenticated user can trigger system-wide queue processing).
- **DZ-13 mitigation.** `fileService.uploadBytes` is non-transactional: R2 PUT then Prisma `create`. If Prisma fails, the R2 object is orphaned permanently. Add an R2 reconciliation sweep, or wrap PUT + create in a try/catch issuing a compensating R2 DELETE on Prisma failure.
- Rate-limit the `upload_file` MCP tool to prevent R2 quota exhaustion in multi-user.
- Cursor-based pagination on `list_files_by_type` once any user accumulates a large file count (cap is 200).
- Upload progress indicator (bytes-sent) on large files. `useUploadFile` does not expose progress; the raw `fetch` to R2 doesn't track sent bytes. Slack/Notion show a progress bar inside the attachment card.

### Deferred features (no schema support yet)

- Persist Whisper `durationSec` and image-handler `tags` (handlers compute them but `File` schema has no columns).
- Video frame thumbnail strip (Phase 2 deferred frame extraction).
- Word-level transcript timestamps for click-to-seek (richer Whisper response storage).
- Frame thumbs as separate File rows.

---

## Wave 3 (Block Editor) — SHIPPED 26. 4. 2026

`@ascend/editor` package with 8 custom Lexical nodes (WikiLink, Mention, AIBlock, Embed, Callout, Toggle, File, Image) + built-in re-exports, theme tokens, Markdown round-trip (12/12 fixtures pass), extractText. `BlockDocument` schema + search_vector trigger extension. `blockDocumentService` + `blockMigrationService` (userId-scoped, size-capped). 6 block-level API routes + AI chat route. 4 React Query hooks (useBlockDocument + sync + migrate + ops). Lexical web binding: `ContextBlockEditor` + 8 plugins (autosave, slash menu, inline toolbar, wikilink + mention autocomplete, keyboard shortcuts, decorator, error boundary). 5 new MCP block tools (50 to 55). AI block integration with Wave 2 `llmService.chat`. Phase 6a simplification: snapshot-only autosave (Yjs CRDT delta path deferred to Wave 8). Production reports 55 MCP tools. Commits: `abee882`, `29aa26a`, `7c8e706`, `1fb9d80`, `c6219b2`, `73bc8b3`, `8872d4b`, `1ace5aa`, `c0a2e5a`. Close-out at `.ascendflow/features/context-v2/wave-3-block-editor/CLOSE-OUT.md`.

## Wave 3 carry-overs (tracked here until picked up)

- **Full Yjs CRDT delta sync.** Wave 3 is snapshot-only autosave. The Yjs binary format is preserved so Wave 8 collaboration can layer `@lexical/yjs` V2 binding on top without migration.
- **Real-time WebSocket sync.** Deferred to Wave 8 collaboration.
- **Streaming AIBlock tokens.** Current implementation returns full result from `llmService.chat`. Streaming via SSE is a Wave 4 polish item.
- **Image / File node rich UIs.** Wave 3 ships placeholder stubs. Wave 4 fills them with real upload + preview UIs via the R2 presigned-URL scaffolding from Wave 0.
- **Database row inline-edit blocks.** Deferred to Wave 5.
- **Block comments.** Deferred to Wave 8 collaboration.
- **Revision history.** Deferred to Wave 7+.
- **Mention scope expansion.** Currently only context entries. @goal/@todo/@user deferred.
- **Embed/Image/File URL sanitization (DZ-11).** No user-facing input produces these nodes with arbitrary URLs in Wave 3. Full sanitization (scheme allowlist, CSP sandbox) ships with Wave 4 file UI.
- **`@ascend/editor` includes DOM types in tsconfig.** Minor cross-platform compromise documented; Lexical's `createDOM()` requires DOM types. Mobile (Wave 6) does not import this package per LEXICAL-SPIKE.md.
- **Rate limiting on block routes.** None in Wave 3. Deferred to a future polish pass alongside the broader rate limiting item (Wave 0 carry-over).
- **`/blocks/reset` admin route.** For recovering from broken Yjs state. Not implemented; current workaround is DB-level deletion of the BlockDocument row.
- **Formal `ax:verify-ui` on the block editor UI.** Playwright run not executed on the block editor, slash menu, inline toolbar, autocomplete, AI block, or error boundary. Deferred.
- **Performance benchmarks (autosave latency, cold-load, slash menu).** Not formally measured. Expected to be within targets based on architecture.

## Older carry-overs (Wave 2, still open)

- **Streaming responses for map refresh.** Current refresh returns the full JSON blob synchronously. Deferred to Wave 4+.
- **Per-purpose / per-tool cost caps.** Wave 8 item.
- **Provider-specific JSON-mode tuning.** Deferred.
- **Map versioning / history.** Wave 8.
- **HNSW index tuning (m, ef_construction).** If context graph grows past 1k entries.
- **ANTHROPIC_API_KEY provisioning.** Built but not runtime-exercised.
- **GitHub Actions cron first execution.** Pending verification.
- **Formal `ax:verify-ui` on Wave 2 UI surfaces.** Deferred.

## Older carry-overs (Wave 1, still open)

- **Performance benchmark on 500-node graphs.** Deferred from Wave 1.
- **Formal `ax:verify-ui` on the graph view.** Wave 1 Phase 8.8 scenario plan was not executed.

---

## Wave 2 (AI-native MCP round 1) — SHIPPED 26. 4. 2026

Provider abstraction (`@ascend/llm`) with Gemini/OpenAI/Anthropic implementations, pgvector embedding pipeline on `ContextEntry` (1536 dims), HNSW index, hybrid search (tsvector + pgvector with UI toggle), Context Map synthesizer with nightly cron (GitHub Actions), 5 new MCP tools (`get_context_map`, `refresh_context_map`, `suggest_connections`, `detect_contradictions`, `summarize_subgraph`), LLM usage tracking with cost caps, provider picker + usage panel in `/settings`, Context Map card on `/context`. Production now reports 50 MCP tools (47 pre-Wave-2 + 3 routed + 2 defined). Commits: `b225ac5`, `f0e67a2`, `c4d5d2e`, `c0e7298`, `71c260f`, `54752cb`, `23c5676`, `cba7d70`, `4a652ac`, `2b0d77e`. Close-out at `.ascendflow/features/context-v2/wave-2-ai-native-mcp-round-1/CLOSE-OUT.md`.

## Wave 2 → Wave 3+ carry-overs (tracked here until picked up)

- **Streaming responses for map refresh.** Current refresh returns the full JSON blob synchronously. Streaming would improve perceived latency for large graphs. Deferred to Wave 3+.
- **Per-purpose / per-tool cost caps.** Today the cost cap is global per user per day. Finer-grained caps (per-tool, per-purpose) are a Wave 8 item.
- **Provider-specific JSON-mode tuning.** Wave 2 uses a prompt-level JSON contract for all providers. Each provider has its own structured output mode (Gemini `response_mime_type`, OpenAI `response_format`, Anthropic tool-use). Tuning per provider would improve reliability. Deferred.
- **Map versioning / history.** Today the map is overwritten on each refresh. Wave 8 should add a history table or version field so users can compare maps over time.
- **HNSW index tuning (m, ef_construction).** Current HNSW index uses pgvector defaults. If the context graph grows past 1k entries, tuning these parameters may improve search quality and build time.
- **ANTHROPIC_API_KEY provisioning.** The Anthropic provider code path is built and type-safe but has not been exercised at runtime because the API key has not been provisioned in Dokploy. Soft-deferred; safe to ship without.
- **GitHub Actions cron first execution.** The nightly map refresh cron (`.github/workflows/nightly-map-refresh.yml`) is configured for 03:00 UTC daily. First execution should be verified after its first run.
- **Formal `ax:verify-ui` on Wave 2 UI surfaces.** The Context Map card, provider picker, and usage panel have not been verified via Playwright. Visual smoke passed via curl + build green. The `ascend-ui-verifier` should run a full scenario plan in a follow-up session.

## Older carry-overs (Wave 1, still open)

- **Performance benchmark on 500-node graphs.** Deferred from Wave 1. Seed a 500-entry fixture and measure `computeLayout` + graph view render perf.
- **Formal `ax:verify-ui` on the graph view.** Wave 1 Phase 8.8 scenario plan was not executed. Still pending.

---

## Wave 1 (Graph Foundation) — SHIPPED 24. 4. 2026

The 15-day plan collapsed into a single focused session: monorepo package `@ascend/graph`, typed `ContextLink` edges, 7 entry types, extended wikilink syntax, graph view (ReactFlow + d3-force), detail panel edges section, Quick Link dialog, entry type selector, Backlinks view, 7 new MCP graph tools. Production now reports 47 MCP tools (40 existing + 7 new). Commits `f36d8a2`, `f684ef5`, `22c9929`, `d86b53c`, `29bf523`, `fa21884`, `2970512`, `fb60017`, `21302ad`. Close-out at `.ascendflow/features/context-v2/wave-1-graph-foundation/CLOSE-OUT.md`.

## Wave 1 → Wave 2+ carry-overs (tracked here until picked up)

- **Performance benchmark on 500-node graphs.** Phase 8.9 was not formally executed; `computeLayout` was verified only with a synthetic 500-node graph during Phase 2 (637ms layout). The graph view (`context-graph-view.tsx`) target is <2s cold / <200ms warm on a 500-entry real database. Seed a 500-entry fixture in a future session and measure.
- **ax:verify-ui on the graph view.** Phase 8.8 listed a UI scenario plan (graph rendering, focus mode, filter chips, inline type change, Quick Link dialog, edit [[relation:X]] → new edge). Deferred to a follow-up ax:verify-ui pass because the session is already long.
- **Optional composite unique `(fromEntryId, toEntryId, type, userId)` on ContextLink.** Today the composite unique is `(fromEntryId, toEntryId, type)`; `userId` enforcement lives in the application layer. Schema-level multi-tenant enforcement would require a migration. Non-blocking.
- **Defense-in-depth userId in the ContextLink upsert where.** The upsert in `contextLinkService.create` and `syncContentLinks` uses the composite unique as its where target; userId scoping is the preceding ownership check rather than part of the constraint. Safe by construction today.
- **Persisted graph layouts.** Current graph layout is computed on every mount via d3-force. For large graphs, caching positions on the server (or in IndexedDB on the client) would give instant re-open. Nice-to-have for Wave 3+.
- **Mobile graph renderer.** `@ascend/graph` is platform-agnostic but ReactFlow is web-only. Wave 6 Expo needs a native renderer (react-native-skia + custom edge/node components) consuming the same `computeLayout` output. Deferred as planned.
- **`getGraph` node cap "degree" currently uses cross-user degree for defense-in-depth `_count` filter.** The `_count.select.outgoingLinks.where: { userId }` was added in Wave 1 Phase 3. Revisit for efficiency if count queries get slow on large graphs.
- **Reporting accuracy: `syncContentLinks.created` overcounts on no-op upserts.** The counter increments unconditionally; when the parser re-encounters an unchanged CONTENT link, the upsert is a no-op but the counter ticks. Not a correctness issue, only observability.

---

## Wave 0 (Platform Foundation) — SHIPPED 22. 4. 2026

The monorepo conversion + shared packages + token auth + presigned upload scaffolding + Lexical spike shipped as 10 commits (3339d4e → 3bda502 → close commit). PRD at `.ascendflow/features/context-v2/wave-0-platform-foundation/PRD.md`. Close-out at `.ascendflow/features/context-v2/wave-0-platform-foundation/CLOSE-OUT.md`.

**DZ-5 resolved.** The duplicated `fetchJson` helper that lived in `use-goals.ts`, `use-todos.ts`, `use-context.ts`, `use-categories.ts`, and `use-dashboard.ts` is collapsed into `@ascend/api-client`. The danger zone is retired from the active list; it is retained in `CLAUDE.md` as historical context only.

## Wave 0 → Wave 8+ carry-overs (tracked here until picked up)

- **Orphan file upload rows.** `apps/web/lib/services/file-service.ts` creates a PENDING `File` row on every `/api/files/presign` call. If the client never uploads, the row persists forever. Wave 8 should add a cron job that deletes PENDING rows older than 24 hours and reconciles R2 objects against the DB.
- **Per-user file storage quota.** Phase 7 enforces per-file size (100 MiB) and MIME allowlist, but no aggregate quota per user. Wave 8 multi-tenant should add a quota.
- **Rate limiting on `/api/files/*` and other write routes.** Phase 6 added login rate limiting only. Wave 8 should add broader rate limiting per authenticated user.
- **SVG XSS gating for file-serving endpoint.** Phase 7 kept `image/svg+xml` in the upload allowlist with a documented gating requirement: when a file-serving endpoint is built, it MUST either drop SVG, sanitize server-side, or serve with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`. See comment in `packages/core/src/schemas/files.ts`.
- **Distributed login rate limiter (Redis).** The in-process `Map` in `authService` works for single-node. Multi-node deployments need Redis. Interface is already Redis-ready; swap when the deployment topology changes.
- **Cookie options shared constant.** `apps/web/middleware.ts` duplicates `buildClearCookieOptions()` because the edge runtime can't import Node's `crypto`. Extract to a shared edge-safe constant in `@ascend/core` in a future cleanup pass so the two locations can't drift.
- **Migrate remaining bare `fetch()` in `apps/web/lib/hooks/use-dashboard.ts`.** Two fire-and-forget recurring-generation triggers still bypass the 401 interceptor. Low risk, but worth migrating to `apiFetch` in a future cleanup pass.

---

## Features deferred mid-session

### Sync Offline Outbox (H9 from design critique)

**Slug:** `sync-offline-outbox`
**Deferred because:** Proper implementation requires IndexedDB, a service worker background sync handler, and conflict resolution UI. Multi-session work. The lean F9 sync-status UI (commit `c733290`) surfaces online/offline state and per-domain last-sync times without a real queue.

**Scope when picked up:**
- IndexedDB-backed mutation queue (wraps around all writes in `api-client.ts`)
- Queue persists across page reloads and browser restarts
- Background sync via service worker when connection resumes
- Conflict resolution: server-wins for v1, detail panel warning banner for v2
- `SyncIndicator` popover shows "N queued changes" with per-change inspect
- Error handling: failed mutations stay in the queue with retry + exponential backoff
- Toasts: "1 change queued" / "5 changes syncing" / "All changes saved"

**Touches:**
- `lib/api-client.ts` — wrap mutation path in queue-first handler
- `public/sw.js` — background sync event handler
- New `lib/offline/outbox.ts` — IndexedDB abstraction (idb or dexie)
- `lib/hooks/use-sync-status.ts` — expose queued count
- `components/layout/sync-status-popover.tsx` — render queued items

**Dependencies:**
- Decide on IndexedDB library: `idb` (zero-dep wrapper) or raw IndexedDB API.
- Schema version for the outbox store.

---

## Design system work deferred

### DS6 — DetailPanel primitive

**Slug:** `detail-panel-primitive`
**Deferred because:** Refactor across `goal-detail`, `todo-detail`, `context-entry-detail`, and `calendar-day-detail`. Each has an ad-hoc version of "title + metadata + separator + sections + danger zone". Extracting shared layout requires careful prop API design and regression testing. Solid afternoon's work.

**Scope when picked up:**
- `components/ui/detail-panel.tsx` with slots: `header`, `metadata`, `sections`, `dangerZone`
- Handles mobile Sheet fallback internally
- Close button, back button (mobile), loading skeleton all built in
- Migrate all 4 detail panels one at a time with a VERIFY step between each

### DS8 — Accessibility pass (axe + Lighthouse)

**Slug:** `accessibility-pass`
**Deferred because:** Requires running axe and Lighthouse across 12 surfaces, triaging findings, and executing fixes. Expected findings: color-only state indicators, `<kbd>` without aria-label, hover-only affordances without focus equivalent, some icon buttons missing aria-label, detail panel close button aria-label in some places. One focused sprint (4-8 hours).

**Scope when picked up:**
- Run axe-core against every `/app/(app)/**` page (scripted via `axe-playwright`)
- Run Lighthouse mobile + desktop per surface
- Fix high-severity findings in one PR per surface
- Add a `docs/accessibility-checklist.md` to keep future changes compliant

### DS10 — Dark mode parity sweep

**Slug:** `dark-mode-parity`
**Deferred because:** Requires manual walkthrough of 12 surfaces in dark theme, screenshot, and fix contrast/token issues surface by surface. Especially important after C1 fix migrated chart colors to oklch tokens.

**Scope when picked up:**
- Screenshot every surface in dark mode (Playwright-driven)
- Audit for: text contrast, icon visibility, border visibility, surface elevation
- Fix any hardcoded colors missed by the C1 sweep
- Commit the screenshots as a baseline in `.ascendflow/visual-regression/dark/`

---

## Feature ideas (not yet scoped)

These aren't committed priorities; they're seeds for future roadmaps.

### Push notifications

- Morning Big 3 reminder at a user-configured time
- Deadline warnings (48h and 24h before)
- Streak-at-risk alerts ("You'll break your 14-day streak if you skip today")
- PWA already supports the Notification API; needs a permission request flow, server-side scheduling (cron or a service), and user preferences in Settings.

### Claude API-powered natural language parsing

- Fallback for the heuristic parser in F7 when confidence is low
- "Parse with AI" button on the todo quick-add input
- Sends the raw input to Claude API with a structured output schema (OpenAI-style tool call or Anthropic's structured outputs)
- Env variable `ANTHROPIC_API_KEY` required
- Cost: ~$0.002 per call with Haiku; could be toggled per-user or rate-limited

### Habit streak heatmap on dashboard

- F4 added the heatmap on recurring todo detail. A condensed version (last 28 days, all habits stacked) could live on the dashboard as a 6th widget.

### Goal timeline integration with calendar

- Goal deadlines are already displayed on the calendar. Extend: show goal start dates as ranges, color-coded by horizon.

### Export-to-markdown for context entries

- Single-click export for context entries as `.md` files with YAML frontmatter (tags, dates, backlinks)
- Useful for Obsidian / Logseq users who want to sync Ascend context to their main vault
