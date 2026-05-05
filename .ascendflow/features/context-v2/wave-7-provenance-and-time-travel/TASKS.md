# Implementation Tasks: Wave 7 (Provenance + time travel)

**PRD:** [PRD.md](./PRD.md)
**Sizing:** 10-15 working days. 12 phases. Each phase ends in a single commit.

Order matters. Each task references actual files. After every phase, run `/ax:test`. Phases are dependency-ordered: Phase N+1 may assume Phase N landed.

## Phase 1: Schema + Zod schemas + migrations

- [ ] **Schema additions in `apps/web/prisma/schema.prisma`**:
  - Add `NodeType` enum: `CONTEXT_ENTRY`, `GOAL`, `TODO`, `DATABASE_ROW`, `DATABASE_FIELD`.
  - Add `VersionTrigger` enum: `EDIT_DEBOUNCED`, `EDIT_BLUR`, `EDIT_EXPLICIT`, `RESTORE`, `BRANCH`, `BACKFILL`, `MIGRATION`.
  - Add `EdgeEventType` enum: `CREATED`, `REMOVED`, `UPDATED`.
  - Extend `ContextLinkType` with `DERIVED_FROM`.
  - Add `NodeVersion` model with all fields, relations, indexes per PRD "Data Model Changes".
  - Add `EdgeEvent` model with `fromEntryId` + `toEntryId` denormalized columns (per Open Question 1, recommended yes).
  - Add `GraphDailySnapshot` model with all fields, indexes per PRD.
  - Add inverse relations on `User` (`nodeVersions`, `edgeEvents`, `graphDailySnapshots`).

- [ ] **Hand-write 4 migrations** (per safety rule 6, never `prisma migrate dev`):
  - `apps/web/prisma/migrations/20260505000001_add_node_version/migration.sql` — enums + table + CHECK constraints + indexes.
  - `apps/web/prisma/migrations/20260505000002_add_edge_event/migration.sql` — enum + table + indexes.
  - `apps/web/prisma/migrations/20260505000003_add_graph_daily_snapshot/migration.sql` — table + CHECK + indexes.
  - `apps/web/prisma/migrations/20260505000004_add_derived_from_link_type/migration.sql` — `ALTER TYPE "ContextLinkType" ADD VALUE 'DERIVED_FROM'`.
  - Use the existing migration in `apps/web/prisma/migrations/20260502*_wave5_*` as the formatting template.
  - Apply locally via `pnpm prisma migrate deploy` (NOT `dev`).
  - Run `pnpm prisma generate`.

- [ ] **Zod schemas** in new file `packages/core/src/schemas/versioning.ts`:
  - `nodeTypeSchema` (z.enum matching the 5 NodeType values).
  - `versionTriggerSchema` (z.enum matching the 7 VersionTrigger values).
  - `edgeEventTypeSchema` (z.enum matching the 3 values).
  - `nodeVersionPayloadSchema` (z.record(z.string(), z.unknown()) — tolerant of unknown fields for forward-compat; actual structure validated by per-type service code).
  - `listVersionsQuerySchema` (`{ limit?: number, cursor?: string }`).
  - `diffVersionsBodySchema` (`{ fromVersionId: string | null, toVersionId: string }`).
  - `restoreVersionBodySchema` (`{ versionId: string, dryRun?: boolean }`).
  - `branchNodeBodySchema` (`{ versionId: string, title: string (1-200 chars) }`).
  - `graphAtQuerySchema` (`{ date: string }` ISO date format).
  - Re-export from `packages/core/src/schemas/index.ts`.
  - Re-export everything from `apps/web/lib/validations.ts`.

- [ ] **Delegate** the migration SQL audit to `ascend-migration-auditor` after generating SQL files. Verify: search_vector untouched, additive only, CHECK constraints present, indexes correct. Block on any FAIL.

- [ ] **`/ax:test`** — typecheck + build pass.

- [ ] **Commit**: `feat(db): Wave 7 Phase 1 — versioning schema + 4 migrations`.

## Phase 2: Diff engine package

- [ ] **Scaffold new package** via `/ax:package` with name `@ascend/diff` at `packages/diff/`. Verify the scaffold sets `"lib": ["ES2022"]` (no DOM lib, pure TS).

- [ ] **Add dev dependencies** for diff: evaluate `fast-diff` (small, line+word) and `jsondiffpatch` (object diff). Recommend `fast-diff` for text and a hand-rolled JSON-tree walker for structured diff (no jsondiffpatch — simpler control of output shape).
  - `pnpm --filter @ascend/diff add fast-diff`.

- [ ] **Implement core diff modules** in `packages/diff/src/`:
  - `types.ts` — `DiffResult` discriminated union (`{ kind: "block-diff" | "field-diff" | "property-diff" | "field-config-diff", ... }`).
  - `text-diff.ts` — wraps `fast-diff`; returns `{ ops: Array<{ op: "equal" | "insert" | "delete", text: string }> }`.
  - `field-diff.ts` — `diffFields(before, after, fieldNames): FieldDiffResult` with `{ added, removed, modified: [{ field, before, after }] }`.
  - `property-diff.ts` — `diffProperties(beforeProps, afterProps, fieldDefs): PropertyDiffResult` with type-aware value comparison (TEXT uses textDiff, NUMBER uses delta, SELECT shows old/new option label, MULTI_SELECT shows added/removed labels, RELATION shows added/removed entry IDs).
  - `block-diff.ts` — walks the Lexical JSON snapshot tree:
    - Identifies blocks by their stable key (Lexical's `__key`) — but Lexical keys are NOT stable across loads (they're per-editor-session). Use a deterministic fallback: `${blockType}:${index}:${textHash(node)}` to match blocks across versions. Document this limitation in the JSDoc.
    - Returns `{ kind: "block-diff", blocks: Array<{ change: "added" | "removed" | "moved" | "modified", block: BlockSnapshot, textDiff?: TextDiffResult }> }`.
  - `field-config-diff.ts` — for DatabaseField config changes (e.g., SELECT options added/removed, RELATION target changed, FORMULA expression changed).
  - `index.ts` — public API: `diffNodeVersions(fromPayload, toPayload, nodeType): DiffResult`. Switch on nodeType, dispatch to the right strategy.

- [ ] **Test fixtures** in `packages/diff/test-fixtures/`:
  - `block-diff/case-1-added-paragraph.before.json` + `.after.json` + `.expected.json`.
  - `block-diff/case-2-modified-text.{before,after,expected}.json`.
  - `block-diff/case-3-removed-block.{before,after,expected}.json`.
  - `block-diff/case-4-moved-block.{before,after,expected}.json`.
  - `field-diff/case-1-rename.{before,after,expected}.json`.
  - `field-diff/case-2-add-field.{before,after,expected}.json`.
  - `property-diff/case-1-text-edit.{before,after,expected}.json`.
  - `property-diff/case-2-multi-select-add.{before,after,expected}.json`.
  - `property-diff/case-3-relation-change.{before,after,expected}.json`.
  - `field-config-diff/case-1-select-options.{before,after,expected}.json`.
  - At minimum 10 fixtures total.

- [ ] **Test runner script** at `packages/diff/scripts/run-fixtures.ts` — walks fixtures, runs `diffNodeVersions`, asserts output matches `.expected.json`. Add to `packages/diff/package.json` as `"test:fixtures": "tsx scripts/run-fixtures.ts"`.

- [ ] **Delegate** the package boundary check to `ascend-architect`. Verify zero React/Next/Prisma imports; only `fast-diff` as a runtime dep.

- [ ] **`/ax:cross-platform-check`** + **`/ax:test`**.

- [ ] **Commit**: `feat(diff): Wave 7 Phase 2 — pure-TS diff engine + 10 fixtures`.

## Phase 3: Versioning service + edge event service

- [ ] **`apps/web/lib/services/versioning-service.ts` (new)**:
  - In-process debounce map: `Map<string, NodeJS.Timeout>` keyed by `${nodeType}:${nodeId}`. Per-process state — best-effort; EDIT_BLUR + EDIT_EXPLICIT triggers guarantee at-least-once.
  - `scheduleSnapshot(userId, nodeType, nodeId, trigger): void` — clears existing timer for this node, sets new one for 60s. If trigger is `EDIT_BLUR` or `EDIT_EXPLICIT`, calls `createSnapshot` immediately and clears the timer.
  - `createSnapshot(userId, nodeType, nodeId, trigger, parentVersionId?): Promise<NodeVersion>`:
    - Reads the live entity via the appropriate service (switch on nodeType).
    - Serializes to JSON.
    - Computes sha256 hash.
    - Looks up latest version by `(nodeType, nodeId)`. If hash matches → return existing without writing (dedup).
    - Computes next `versionNumber` (max + 1, or 1 if first).
    - Writes the NodeVersion row. Handle CHECK violation (10 MiB) gracefully: log error, return null without throwing (so the originating mutation isn't rolled back).
  - `listVersions(userId, nodeType, nodeId, opts): Promise<{ versions, nextCursor }>` — userId-scoped findMany, ordered by createdAt DESC, paginated by cursor.
  - `getVersion(userId, versionId): Promise<NodeVersion>` — userId-scoped findFirst.
  - `flushPendingSnapshots(userId?): Promise<void>` — for graceful shutdown / tests.
  - **Use `apps/web/lib/services/block-document-service.ts` as the structural template** (size-cap pattern, transaction wrapping, error handling).
  - Every Prisma query includes `userId` per safety rule 1.

- [ ] **`apps/web/lib/services/edge-event-service.ts` (new)**:
  - `logCreated(userId, link)`, `logRemoved(userId, link)`, `logUpdated(userId, before, after)`.
  - Each writes an EdgeEvent row with `linkSnapshot` (full link including denormalized `fromEntryId` + `toEntryId`).
  - `listEventsForEntry(userId, entryId, opts)` — userId-scoped query for "edges involving this entry over time".

- [ ] **`apps/web/lib/services/diff-service.ts` (new)**:
  - `diffVersions(userId, fromVersionId, toVersionId): Promise<DiffResult>`.
  - Verifies both versions belong to the same user AND the same `(nodeType, nodeId)` before diffing. Throws on mismatch.
  - Calls `diffNodeVersions(from.payload, to.payload, from.nodeType)` from `@ascend/diff`.
  - Special case: `fromVersionId = null` → fetches the live entity, treats it as the "current" snapshot (per Open Question 6).

- [ ] **`apps/web/lib/services/restore-service.ts` (new)**:
  - `restore(userId, versionId, dryRun = false): Promise<RestoreResult>`.
  - Userid-scoped fetch of target version.
  - Per nodeType, dispatches to the right service's update path:
    - `CONTEXT_ENTRY` → `contextService.update(userId, nodeId, payload-derived patch)` + `blockDocumentService.replaceSnapshot(userId, entryId, payload.blockDocumentSnapshot)`.
    - `GOAL` → `goalService.update(userId, nodeId, payload-derived patch)`.
    - `TODO` → `todoService.update(userId, nodeId, payload-derived patch)`.
    - `DATABASE_ROW` → `databaseRowService.update(userId, nodeId, payload.properties)` + body restore.
    - `DATABASE_FIELD` → `databaseFieldService.update(userId, nodeId, payload-derived patch)`.
  - Before mutating: schedule a snapshot of the CURRENT state with trigger `EDIT_EXPLICIT` (forward snapshot per Open Question 4).
  - After mutating: create a `RESTORE`-triggered snapshot.
  - Returns `{ restoredVersionId, newVersionId, warnings: ["edges not time-traveled"] }`. ContextLink references that no longer resolve get added to `warnings`.
  - `dryRun: true` returns `{ previewPayload, warnings }` without mutating.

- [ ] **`apps/web/lib/services/branch-service.ts` (new)**:
  - `branch(userId, versionId, title): Promise<BranchResult>`.
  - Validates source nodeType is branch-eligible (CONTEXT_ENTRY of NOTE/SOURCE/PROJECT/PERSON/DECISION/QUESTION/AREA, or DATABASE_ROW). Other types → throw 400.
  - Cycle detection: walks `DERIVED_FROM` edges backward from the source node (max 100 hops); refuses if walking would loop.
  - Soft-cap warning at > 5 derivatives (returned in result; UI surfaces).
  - Hard-cap throw at > 50 direct derivatives.
  - Creates new entity via the appropriate service's `create` method, copying payload (excluding original's primary key + timestamps).
  - Creates `DERIVED_FROM` ContextLink (new node → original) via `contextLinkService.create`.
  - Schedules `BRANCH`-triggered snapshot on the new node.

- [ ] **`apps/web/lib/services/graph-history-service.ts` (new)**:
  - `getGraphAt(userId, date: Date): Promise<GraphPayload>`.
  - If `date >= startOfTodayUTC()` → delegate to `contextService.getGraph(userId)` (live).
  - Else → look up `GraphDailySnapshot` for `(userId, snapshotDate = date at UTC midnight)`. Return the stored payload. If not found and date is within 90 days → throw 404 ("snapshot not yet computed; try later"). If date older than 90 days → throw 410.

- [ ] **`apps/web/lib/services/graph-snapshot-service.ts` (new)**:
  - `precomputeDailySnapshot(userId, date): Promise<GraphDailySnapshot>`.
  - Builds graph at `date` by:
    - For each ContextEntry owned by user: find latest NodeVersion with `createdAt <= date`. If none → entity didn't exist yet, skip.
    - For each ContextLink: replay EdgeEvents for that link ≤ date to determine if it existed at that time.
  - Materializes into the same shape as `contextService.getGraph` (nodes + edges arrays with id, label, type, color, position).
  - Upserts on `(userId, snapshotDate)`. Idempotent.
  - `precomputeAllForYesterday(): Promise<{ usersProcessed, snapshotsWritten }>` — iterates all users, calls `precomputeDailySnapshot(user, yesterday)`.

- [ ] **`apps/web/lib/services/retention-compactor-service.ts` (new)**:
  - `compactUserVersions(userId): Promise<{ deleted: number }>`.
  - Walks NodeVersion rows for the user, grouped by `(nodeType, nodeId)`, ordered by `createdAt DESC`.
  - Applies retention policy: keep all from last 30 days → keep 1 per UTC-day from days 31-60 → keep 1 per UTC-week (Monday-anchored) older than that.
  - Selects surplus IDs and bulk-deletes via raw SQL `DELETE FROM "NodeVersion" WHERE id = ANY($1) AND "userId" = $2` (userId guard for defense-in-depth).
  - `compactAllUsers(): Promise<{ usersProcessed, totalDeleted }>` — iterates all users.

- [ ] **`/ax:test`** + **delegate `ascend-reviewer`** for safety-rule sweep on the new services.

- [ ] **Commit**: `feat(services): Wave 7 Phase 3 — versioning/diff/restore/branch/graph-history/snapshot/retention services`.

## Phase 4: Snapshot triggers (wire into existing services)

- [ ] **`apps/web/lib/services/context-service.ts`**:
  - `update`: after Prisma update succeeds, call `versioningService.scheduleSnapshot(userId, "CONTEXT_ENTRY", id, "EDIT_DEBOUNCED")`.
  - `delete`: BEFORE deleting, call `versioningService.createSnapshot(userId, "CONTEXT_ENTRY", id, "EDIT_EXPLICIT")` synchronously (so the version remains visible after the entry is gone). Then delete.

- [ ] **`apps/web/lib/services/block-document-service.ts`**:
  - `persistSnapshot` (existing autosave path): after persisting the BlockDocument row, schedule snapshot for the parent `CONTEXT_ENTRY` (find via `contextEntry.findFirst({ where: { blockDocumentId: id } })`). The two-stage debounce (editor's 1.5s autosave + versioning's 60s) is the intended behavior per Open Question 2.

- [ ] **`apps/web/lib/services/goal-service.ts`**:
  - `update`, `complete`, `archive`: schedule `GOAL` snapshot.
  - `delete`: createSnapshot synchronously before delete.

- [ ] **`apps/web/lib/services/todo-service.ts`**:
  - `update`, `complete`: schedule `TODO` snapshot.
  - `delete`: createSnapshot synchronously before delete.

- [ ] **`apps/web/lib/services/database-row-service.ts`**:
  - `update`: schedule `DATABASE_ROW` snapshot.
  - `delete`: createSnapshot synchronously before delete.

- [ ] **`apps/web/lib/services/database-field-service.ts`**:
  - `update`, `changeType`, `reorder`: schedule `DATABASE_FIELD` snapshot.
  - `delete`: createSnapshot synchronously before delete.

- [ ] **`apps/web/lib/services/context-link-service.ts`**:
  - At every write path (`create`, `update`, `delete`, plus the wikilink-content-sync path that adds/removes links from parsed markdown), additionally call `edgeEventService.logCreated/logUpdated/logRemoved`. NEVER throw if the event log write fails — use try/catch and log; the originating mutation must succeed even if event logging fails.

- [ ] **API integration touchpoint** — POST `/api/auth/logout` should call `versioningService.flushPendingSnapshots(userId)` before clearing the session, so any in-flight debounce drains. Add this call.

- [ ] **`/ax:test`** + **delegate `ascend-reviewer`** for the cross-cutting changes (multiple services touched).

- [ ] **Commit**: `feat(services): Wave 7 Phase 4 — snapshot triggers wired into mutating services`.

## Phase 5: Backfill script

- [ ] **`apps/web/scripts/backfill-versions.ts` (new)**:
  - Connect to Prisma.
  - For each user:
    - For each ContextEntry: if no NodeVersion exists for `("CONTEXT_ENTRY", id)`, create v1 with trigger `BACKFILL`.
    - For each Goal: same with `("GOAL", id)`.
    - For each Todo: same with `("TODO", id)`.
    - For each DatabaseRow: same with `("DATABASE_ROW", id)`.
    - For each DatabaseField: same with `("DATABASE_FIELD", id)`.
    - For each ContextLink: write an EdgeEvent of type `CREATED` with the link snapshot.
  - Idempotent: skip nodes that already have any version; skip links that already have a CREATED event.
  - Print progress every 100 entities.
  - Wraps in `await prisma.$disconnect()` on exit.
  - **Use `apps/web/scripts/backfill-embeddings.ts` as the structural template** (Wave 2's analog).

- [ ] **`pnpm tsx apps/web/scripts/backfill-versions.ts`** locally first; verify counts match expected (NodeVersion count = sum of entity counts; EdgeEvent count = ContextLink count).

- [ ] **For prod backfill**: run from a Dokploy console session post-deploy of Phase 1 schema. Document the command in CLOSE-OUT.md.

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(scripts): Wave 7 Phase 5 — backfill versions and edge events`.

## Phase 6: API routes

- [ ] **`apps/web/app/api/versions/[nodeType]/[nodeId]/route.ts` (new)**: `GET` → `versioningService.listVersions`. Auth via `authenticate`. Validate `nodeType` against the enum.

- [ ] **`apps/web/app/api/versions/[id]/route.ts` (new)**: `GET` → `versioningService.getVersion`. 404 if not found.

- [ ] **`apps/web/app/api/versions/diff/route.ts` (new)**: `POST` → `diffService.diffVersions`. Body validated via `diffVersionsBodySchema`.

- [ ] **`apps/web/app/api/versions/restore/route.ts` (new)**: `POST` → `restoreService.restore`. Body validated via `restoreVersionBodySchema`.

- [ ] **`apps/web/app/api/versions/branch/route.ts` (new)**: `POST` → `branchService.branch`. Body validated via `branchNodeBodySchema`.

- [ ] **`apps/web/app/api/graph/at/route.ts` (new)**: `GET` → `graphHistoryService.getGraphAt`. Query validated via `graphAtQuerySchema`. Returns 410 for dates older than 90 days.

- [ ] **`apps/web/app/api/versions/compact/route.ts` (new)**: `POST`, cron-only via `verifyCronSecret` (the shared helper extracted in the Wave 5 polish batch). Returns `{ usersProcessed, versionsDeleted }`.

- [ ] **`apps/web/app/api/graph/snapshots/precompute/route.ts` (new)**: `POST`, cron-only via `verifyCronSecret`. Returns `{ usersProcessed, snapshotsWritten }`.

- [ ] **All routes follow the auth-parse-service-respond pattern** in `.claude/rules/api-route-patterns.md`. Use `authenticate` (not `validateApiKey`). Use `handleApiError` in catch.

- [ ] **Cron workflows**:
  - `.github/workflows/version-retention.yml` (new) — runs at 03:00 UTC daily, hits `POST /api/versions/compact` with `x-cron-secret`. Use `.github/workflows/nightly-map-refresh.yml` as the template.
  - `.github/workflows/graph-daily-snapshot.yml` (new) — runs at 03:30 UTC daily, hits `POST /api/graph/snapshots/precompute`.

- [ ] **Delegate** the API audit to `ascend-security`. Verify userId scoping, cron-secret timing-safe compare, no Bearer-key path on cron-only routes.

- [ ] **`/ax:test`** + `/ax:review`.

- [ ] **Commit**: `feat(api): Wave 7 Phase 6 — versioning + graph-history routes + 2 cron workflows`.

## Phase 7: React Query hooks

- [ ] **Cache keys** in `apps/web/lib/queries/keys.ts`:
  ```ts
  versions: {
    all: () => ["versions"] as const,
    list: (nodeType, nodeId) => [...keys.versions.all(), "list", nodeType, nodeId] as const,
    detail: (versionId) => [...keys.versions.all(), "detail", versionId] as const,
    diff: (from, to) => [...keys.versions.all(), "diff", from, to] as const,
  },
  graph: {
    // existing graph keys
    at: (date: string) => [...keys.context.all(), "graph", "at", date] as const,
  },
  ```

- [ ] **`apps/web/lib/hooks/use-versions.ts` (new)**:
  - `useVersions(nodeType, nodeId, opts?)` — `useQuery` against `GET /api/versions/[nodeType]/[nodeId]`. 5min staleTime.
  - `useVersion(versionId)` — `useQuery` against `GET /api/versions/[id]`. 1h staleTime (versions are immutable).
  - `useDiff(from, to)` — `useQuery` against `POST /api/versions/diff` (use POST despite being a read; body sometimes large). 1h staleTime.
  - `useRestore()` — `useMutation`. `onSuccess`: per-nodeType cross-domain invalidation per PRD "Cache Invalidation".
  - `useBranch()` — `useMutation`. `onSuccess`: invalidate context list + graph + contextLinks. Toast: "Branched. Opening new entry...". Programmatic navigation to new entry.
  - `useGraphAt(date | null)` — `useQuery`. Conditional `enabled: !!date`. 24h staleTime. Disabled when date is null (component falls back to live `useContextGraph`).

- [ ] **`apps/web/lib/api-client.ts` extension** — verify the existing `apiFetch` handles POST with body for the diff endpoint (it does — used by other waves).

- [ ] **Use `apps/web/lib/hooks/use-block-document.ts` as the structural template** (it has a similar mix of useQuery + useMutation with cross-domain invalidation).

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(hooks): Wave 7 Phase 7 — version + graph-at React Query hooks`.

## Phase 8: Version history panel + diff modal (UI core)

- [ ] **Check `.claude/COMPONENT_CATALOG.md`** for any existing collapsible panel or diff-renderer patterns to reuse. None expected; this is new ground.

- [ ] **`apps/web/components/versioning/version-history-panel.tsx` (new)**:
  - Props: `nodeType: NodeType`, `nodeId: string`.
  - State: collapsed/expanded persisted via `useUIStore.versionHistoryExpanded[${nodeType}:${nodeId}]`.
  - Renders header: `<button aria-expanded={...}>{count} versions <Chevron/></button>`.
  - Expanded body: list of last 20 versions. Each row: timestamp ("3 hours ago" via date-fns `formatDistanceToNow`), trigger badge ("Auto-saved" / "Restored" / "Explicit save" / "Branched" / "Backfill"), three inline icon-buttons: Diff (compares vs current), Restore (fires `useRestore`), Branch (only on branchable types; opens `BranchDialog`).
  - "Show all 47 versions" link below the 20 → expands to full pagination.
  - Skeleton state for loading; empty state ("No version history yet") for nodes with zero versions (rare; backfill should cover all existing entries).

- [ ] **`apps/web/components/versioning/version-diff-modal.tsx` (new)**:
  - Props: `nodeType`, `nodeId`, `fromVersionId | null` (null = current), `toVersionId`, `open`, `onClose`.
  - Header: version selector (dropdowns for from + to), Restore + Branch action buttons.
  - Body: switch on nodeType, render the appropriate `*-diff-renderer.tsx`.
  - On wide viewport (≥1024px): three columns (older payload preview / diff summary / newer payload preview).
  - On narrow (<1024px): tabbed (Older / Diff / Newer) per Open Question 3.
  - Uses `Dialog` + `DialogContent` from `apps/web/components/ui/dialog.tsx`.
  - Accessibility per `.claude/rules/accessibility.md` (focus trap via Dialog, Escape closes, focus restored).

- [ ] **`apps/web/components/versioning/diff-renderers/block-diff-renderer.tsx` (new)**:
  - Renders block-level diff: each block as a card with status badge (Added / Removed / Moved / Modified). Modified blocks expand to show inline text-diff with red strikethrough on deletes + green underline on inserts.
  - Uses Tailwind colors that meet WCAG AA contrast: red-700 on red-50 for deletes, green-700 on green-50 for inserts.

- [ ] **`apps/web/components/versioning/diff-renderers/field-diff-renderer.tsx` (new)**:
  - Generic key/value table. Columns: Field / Before / After. Modified rows highlighted.
  - Used for ContextEntry metadata, Goal, Todo.

- [ ] **`apps/web/components/versioning/diff-renderers/property-diff-renderer.tsx` (new)**:
  - Per-field-type rows (TEXT, NUMBER, DATE, etc.). Reuses property cell renderers from `apps/web/components/databases/property-editors/` in read-only mode for value display.

- [ ] **`apps/web/components/versioning/diff-renderers/field-config-diff-renderer.tsx` (new)**:
  - Specialized renderer for DatabaseField config changes (type changes, options added/removed, FORMULA expression diff).

- [ ] **`apps/web/components/versioning/branch-dialog.tsx` (new)**:
  - Title input (pre-filled `<original> (branch)`), source preview (one-line summary), Create button.
  - Soft warning banner if source has > 5 derivatives.
  - Hard error if source has ≥ 50 derivatives (server enforces; UI surfaces).

- [ ] **`apps/web/components/versioning/restore-confirmation-dialog.tsx` (new)**:
  - Confirmation modal before `useRestore`. Body: "Restore version N from <timestamp>? Edges (links to other entries) will NOT be reverted. The current state will be saved as a version before restore." Buttons: Cancel / Restore.

- [ ] **Mount `<VersionHistoryPanel />`** in:
  - `apps/web/components/context/context-entry-detail.tsx` — below the block editor body, above the edges panel. Type: `CONTEXT_ENTRY`.
  - `apps/web/components/goals/goal-detail.tsx` — at the bottom of the panel. Type: `GOAL`.
  - `apps/web/components/todos/todo-detail.tsx` — at the bottom. Type: `TODO`.
  - `apps/web/components/databases/database-row-properties.tsx` — below the relation backlinks panel. Type: `DATABASE_ROW`.
  - For DATABASE_FIELD: add a "Version history" item to the kebab menu on `apps/web/components/databases/table-view/table-header-cell.tsx` — opens the diff modal directly with the field's most recent + current.

- [ ] **Delegate `ascend-ux`** for visual review on the diff modal layout, color contrast on diff highlights, and panel collapse animation.

- [ ] **`/ax:test`** + **`/ax:verify-ui`** with scenario: open an entry, verify panel renders, click a version, verify diff modal opens with correct content.

- [ ] **Commit**: `feat(ui): Wave 7 Phase 8 — version history panel + diff modal + 4 type-aware renderers`.

## Phase 9: Time slider on graph view

- [ ] **`apps/web/components/context/context-graph-time-slider.tsx` (new)**:
  - Horizontal slider component. Range: 90 days ago → today. Default position: today (= "Now").
  - Tick marks every 7 days with light labels ("Apr 30", "Apr 23", etc.).
  - "Now" label on right side; "90d ago" on left.
  - Drag handle uses pointer events with `setPointerCapture` (per the Wave 5 timeline-view pattern).
  - On change, fires `onDateChange(date | null)` — null when at "Now".
  - `useUIStore.graphViewAtDate` reads/writes the slider position (transient, not persisted).
  - Reduced-motion-aware: when `prefers-reduced-motion`, snaps to nearest day on release instead of smooth scrub.

- [ ] **`apps/web/components/context/context-graph-view.tsx` modifications**:
  - Add internal state for `atDate` synced with `useUIStore.graphViewAtDate`.
  - Mount `<ContextGraphTimeSlider onDateChange={setAtDate} />` above the graph canvas.
  - When `atDate` is set, use `useGraphAt(atDate)` instead of `useContextGraph()`.
  - When `atDate` is set, render a banner at the top: "Viewing graph as it was on D. M. YYYY. Edits disabled. [Return to now]" — banner uses warning color tokens from `@ascend/ui-tokens`.
  - Disable node interactions (drag, click-to-edit) when `atDate` is set; keep zoom/pan enabled.
  - "Return to now" pill clears `atDate` (also clears Zustand state).

- [ ] **Edge case**: if `useGraphAt` returns 404 (snapshot not yet computed for this user), render fallback banner: "Snapshot not yet computed for this date. Try later or use 'Return to now'." Don't crash.

- [ ] **Edge case**: if `useGraphAt` returns 410 (date older than 90 days), the slider should not allow that position; clamp to the 90-day floor.

- [ ] **Delegate `ascend-ux`** for visual review on slider styling, banner color contrast, and transition feel.

- [ ] **`/ax:verify-ui`** scenario: open graph view, drag slider back, verify banner appears, verify graph re-renders, click "Return to now", verify live state returns.

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(ui): Wave 7 Phase 9 — time slider on graph view + 90-day GraphDailySnapshot`.

## Phase 10: MCP tools

- [ ] **JSON Schema** in `apps/web/lib/mcp/schemas.ts` — append to `TOOL_DEFINITIONS`:
  - `list_versions` — params: `nodeType` (enum 5 values), `nodeId` (string), `limit?` (number, max 100).
  - `get_version` — params: `versionId` (string).
  - `diff_versions` — params: `fromVersionId` (string nullable), `toVersionId` (string).
  - `restore_version` — params: `versionId` (string), `dryRun?` (boolean).
  - `branch_node` — params: `versionId` (string), `title` (string, 1-200 chars).
  - Use `NODE_TYPE_ENUM` constant alongside existing enum constants.

- [ ] **Handler file** `apps/web/lib/mcp/tools/version-tools.ts` (new):
  - `handleVersionTool(userId, name, args): Promise<McpContent>`.
  - Switch on name → calls `versioningService.listVersions/getVersion`, `diffService.diffVersions`, `restoreService.restore`, `branchService.branch`.
  - Each case Zod-validates `args` via the corresponding schema imported from `lib/validations.ts`.
  - Returns `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`.
  - Error handling per `.claude/rules/mcp-tool-patterns.md` (catch `ZodError` separately).

- [ ] **Routing** in `apps/web/lib/mcp/server.ts`:
  - Add `VERSION_TOOL_NAMES = new Set(["list_versions", "get_version", "diff_versions", "restore_version", "branch_node"])`.
  - In the `CallToolRequestSchema` handler, add: `if (VERSION_TOOL_NAMES.has(name)) return handleVersionTool(userId, name, args ?? {});`.

- [ ] **Verify tool count** post-deploy: `curl /api/mcp tools/list` should report 73 tools.

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(mcp): Wave 7 Phase 10 — 5 versioning MCP tools (68 → 73)`.

## Phase 11: Branching wiring + final UI integration

- [ ] **`apps/web/components/versioning/branch-dialog.tsx`**: wire to `useBranch()` mutation. On success → toast "Branched." → `router.push("/context/" + newNodeId)`. Fire smaller confetti via `apps/web/lib/confetti.ts` (use `fireFirstRowConfetti` or add `fireBranchConfetti` with similar size).

- [ ] **Add "Branch this" item** to detail-panel kebab menus (where applicable):
  - `apps/web/components/context/context-entry-detail.tsx` — kebab menu item "Branch", opens `BranchDialog` with `versionId = currentVersionId` (latest version of this entry).
  - `apps/web/components/databases/database-row-properties.tsx` — same.
  - Goal + Todo: NO branch item (not branch-eligible per PRD).

- [ ] **Soft-warning banner** in BranchDialog when source has > 5 derivatives (returned from `useBranch.mutate` `onError` with `code: "DERIVATIVE_LIMIT_WARNING"` — server returns soft 200 with warning, hard 400 at 50).

- [ ] **Restore button in DiffModal**: opens `RestoreConfirmationDialog`; on confirm, fires `useRestore.mutate({ versionId })`; success toast "Restored.", modal closes; entry detail re-fetches via cache invalidation.

- [ ] **Empty-state polish on VersionHistoryPanel** for backfill edge case (entries created before Wave 7 backfill ran will have no versions until first edit; should never happen post-backfill, but defense-in-depth).

- [ ] **Keyboard shortcut for diff modal close**: Escape (already provided by Dialog primitive).

- [ ] **Delegate `ascend-ux`** for full-flow polish review: panel → diff modal → restore confirm → branch dialog. Verify visual consistency with detail panel design language.

- [ ] **`/ax:verify-ui`** scenario: open note → edit → wait for snapshot → open panel → click version → diff modal → restore → confirm content reverted → check version count incremented by 2 (forward snapshot + restore snapshot). Then open kebab → branch → confirm new entry opens.

- [ ] **`/ax:test`** + `/ax:review`.

- [ ] **Commit**: `feat(ui): Wave 7 Phase 11 — branching dialog + restore confirm + kebab integrations`.

## Phase 12: Wave close

- [ ] **`/ax:critique`** — launch `ascend-critic` for product quality verdict. Required: GOOD or WORLD-CLASS. NEEDS WORK or NOT READY blocks close.

- [ ] **Run `ascend-reviewer`** in cumulative mode against the full Wave 7 diff. Address any blocking findings.

- [ ] **Run `ascend-security`** audit on Wave 7 routes (8 new routes: 5 user-facing + 1 graph + 2 cron). Verify userId scoping, cron-secret timing-safe compare, no Bearer-key path on cron routes.

- [ ] **Address all blocking critic must-fixes** before close.

- [ ] **Update `CLAUDE.md`**:
  - **Architecture subsection: "Provenance + time travel (Wave 7)"** — describe NodeVersion, EdgeEvent, GraphDailySnapshot tables; the 7 versioned services hooked into mutations; the diff engine package; the time slider; branching.
  - **Entity Model rows**: NodeVersion, EdgeEvent, GraphDailySnapshot.
  - **Views table row**: "Time slider on graph view" + "Version history panel" + "Side-by-side diff modal".
  - **Key File Lookup entries** (15+ new): all new services, the @ascend/diff package, all UI components, all 8 routes, the hooks file, the MCP tool file.
  - **Danger Zones**: DZ-17 (snapshot storage runaway), DZ-18 (restore semantics), DZ-19 (graph-as-it-was performance), DZ-20 (branching circularity).
  - **MCP Server section**: tool count 68 → 73; list the 5 new tools.

- [ ] **Update `.ascendflow/BACKLOG.md`** with Wave 7 ship summary + carry-overs (per-user retention customization, mention scope on history search, time slider beyond 90 days, edge history viewer, merge UI).

- [ ] **Write `CLOSE-OUT.md`** at `.ascendflow/features/context-v2/wave-7-provenance-and-time-travel/CLOSE-OUT.md` per the Wave 5 template:
  - Success criteria audit (every checkbox: DONE / SKIPPED with reason / NOT DONE with reason).
  - Reviewer + critic + security audit results.
  - Pre-deploy checklist.
  - Wave 8 onramp (workspaces + collaboration; the workspaceId nullable columns are ready).

- [ ] **Write reviewer + critic artifacts** to `.ascendflow/reviews/<date>-wave7-close.md` and `.ascendflow/critiques/<date>-wave7-close.md`.

- [ ] **Run prod backfill** post-deploy: `pnpm tsx apps/web/scripts/backfill-versions.ts` from a Dokploy console session against the prod DB.

- [ ] **Run prod cron one-shot**: hit `POST /api/graph/snapshots/precompute` once to seed yesterday's snapshot before the daily cron picks up.

- [ ] **Manual prod smoke** (per PRD "Success Test"). Document results in CLOSE-OUT.md.

- [ ] **`/ax:wave-close 7`** — runs the strict completion ritual.

- [ ] **`/ax:deploy-check`** — pre-push gate.

- [ ] **Commit**: `chore(wave-7): close Wave 7 — provenance and time travel shipped`.

## Verification phase (already covered by Phase 12 above)

- [ ] `npx tsc --noEmit` — must pass.
- [ ] `pnpm build` — must pass.
- [ ] `/ax:review` — must pass with all blocking findings addressed.
- [ ] `/ax:verify-ui` — must pass with the scenarios in Phases 8, 9, 11.
- [ ] `/ax:critique` — must return GOOD or WORLD-CLASS.
- [ ] `/ax:cross-platform-check` — must pass after Phase 2 (the @ascend/diff package).
- [ ] `/ax:wave-close 7` — strict close ritual must pass.
- [ ] `/ax:deploy-check` — pre-push gate must pass.
