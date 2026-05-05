# Wave 7: Provenance + time travel

**Slug:** `context-v2` / `wave-7-provenance-and-time-travel`
**Created:** 4. 5. 2026
**Status:** planning
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md) (W7 section, ~line 460)
**Wave sizing:** 2-3 weeks per VISION; target 10-15 working days at the cadence Waves 0-5 hit.

## Problem

Ascend is now a rich personal OS: notes, todos, goals, blocks, files, databases, AI map, graph, calendar. Every node is editable. Every edit is destructive — there is no way to see what an entry looked like yesterday, what edges existed last week, or what state the graph was in at a meaningful past point. A user cannot recover content lost to a bad merge. A user cannot show "this is what I believed last quarter". An AI agent (via MCP) cannot reason about how a decision evolved over time. There is no audit trail.

Wave 7 makes every change reversible and every state queryable. Snapshots of every node-shaped entity (ContextEntry, Goal, Todo, DatabaseRow, DatabaseField) are written to an append-only `NodeVersion` table. Every edge create/remove/update writes an `EdgeEvent`. A diff engine renders structural diffs per entity type. The graph view gets a time slider that re-renders the graph as it was on any past day. Notes and rows can be branched: fork at any version, edit the fork, optionally merge later (merging is Wave 8 territory). MCP exposes 5 new tools so agents can list, fetch, diff, restore, and branch.

This is the foundation for trust. Without provenance, an AI-native operating system is a black box: you can't tell what changed, you can't undo, you can't audit. Wave 7 makes the graph self-describing across time.

## User Story

As a user, I want every change to my notes, todos, goals, database rows, fields, and edges recorded so that I can see what changed, when, by whom (eventually), and roll back any mistake. I want to scrub a time slider on the graph view and see what my context looked like on any past day. I want to fork a note or a row to draft a rewrite without destroying the original. As an AI agent connected via MCP, I want to query a node's full version history, compute diffs between versions, and propose restores or branches on the user's behalf.

## Success Criteria

### Functional

- [ ] **`NodeVersion` table** — append-only, immutable. Polymorphic via `nodeType` enum + `nodeId` string. Every snapshot stores: full node payload (JSONB), content hash (sha256), byte size, trigger reason, createdAt, createdBy (userId), workspaceId (nullable, for Wave 8 prep).
- [ ] **`EdgeEvent` table** — append-only log of every ContextLink mutation. Stores: eventType (`CREATED` / `REMOVED` / `UPDATED`), edge snapshot at event time (JSONB), createdAt, createdBy, workspaceId (nullable).
- [ ] **5 versioned node types**: `CONTEXT_ENTRY` (covers all 9 entry types including DATABASE and RECORD), `GOAL`, `TODO`, `DATABASE_ROW`, `DATABASE_FIELD`. Note: `BlockDocument` snapshots ride along inside the `CONTEXT_ENTRY` and `DATABASE_ROW` payloads (the Yjs binary state + JSON snapshot are part of the entry's serialized form), so block-level history is captured implicitly.
- [ ] **Snapshot trigger** — debounced. After any qualifying mutation, the system schedules a snapshot 60 seconds later. If another mutation hits within the window, the timer resets. If the user blurs the editor, navigates away, or hits explicit save, the snapshot fires immediately. Hash-based dedup: skip if the content hash equals the latest version for that node.
- [ ] **Retention policy** — keep all versions for 30 days, then thin to 1 per day for the next 30 days, then 1 per week forever. Implemented as a nightly cron compactor that walks `NodeVersion` per (nodeType, nodeId) and deletes surplus rows. Idempotent.
- [ ] **Backfill on migration** — a one-shot script creates a `v1` snapshot for every existing entity (ContextEntry, Goal, Todo, DatabaseRow, DatabaseField). Idempotent (skips if any version already exists for that node).
- [ ] **Diff engine** — pure-TS, per-node-type strategies: BlockDocument-bearing entries get block-level diff (added / removed / moved / modified blocks, with text-diff inside modified blocks); ContextEntry metadata + Goal + Todo get field-level diff; DatabaseRow gets property-level diff (per fieldId, with type-aware value diff); DatabaseField gets config-level diff. Returns a structured `DiffResult` discriminated union per type.
- [ ] **Version history panel** — `VersionHistoryPanel` mounts in: ContextEntry detail (`apps/web/components/context/context-entry-detail.tsx`), Goal detail (`apps/web/components/goals/goal-detail.tsx`), Todo detail (`apps/web/components/todos/todo-detail.tsx`), DatabaseRow detail (`apps/web/components/databases/database-row-properties.tsx`). Collapsible, shows last 20 versions with createdAt + trigger reason; "Show all" expands; click a version → opens side-by-side diff modal.
- [ ] **Side-by-side diff modal** — `VersionDiffModal` renders the structural diff for the selected version pair using the type-aware diff renderer. Three-pane layout (left: older version, center: diff summary, right: newer version) on wide viewports; stacked on narrow.
- [ ] **Restore action** — "Restore this version" button in the diff modal and the history panel. Restoring does NOT mutate history; it writes the older payload as the current state and creates a new `restored from vN` snapshot. ContextLinks are NOT time-traveled (current edges remain) — surfaced as an explicit dialog before confirm.
- [ ] **Branching** — for BlockDocument-bearing nodes only (`CONTEXT_ENTRY` of type NOTE/SOURCE/PROJECT/PERSON/DECISION/QUESTION/AREA, plus `DATABASE_ROW`). "Branch from this version" action in the diff modal and detail kebab menu. Creates a new node with the same type, copies the snapshot's payload, creates a `DERIVED_FROM` edge (new `ContextLinkType` value) from the new node back to the original at the source version. Cycle detection prevents branching A → B → A.
- [ ] **Time slider on graph view** — `ContextGraphTimeSlider` overlays the graph view (`apps/web/components/context/context-graph-view.tsx`). Horizontal slider spanning the last 90 days; default position = "now". Dragging triggers `useGraphAt(date)` which fetches the precomputed daily snapshot. Visible "Viewing past state" banner when not at "now". Click "Return to now" pill to reset.
- [ ] **`GraphDailySnapshot` table + nightly compute** — to make graph-at-date queries fast, a nightly cron precomputes "graph at midnight UTC" for the trailing 90 days (sliding window). Stores nodes + edges as JSONB. The "now" slider position skips the snapshot table and queries live state. Older than 90 days returns empty (the slider is 90-day capped).
- [ ] **5 new MCP tools (round 6)**: `list_versions(nodeType, nodeId, limit?)`, `get_version(versionId)`, `diff_versions(fromVersionId, toVersionId)`, `restore_version(versionId, dryRun?)`, `branch_node(versionId, title)`. Tool count: **68 → 73**.
- [ ] **No data loss on schema changes** — adding columns to `ContextEntry`, `Goal`, etc. in future migrations does not break old snapshots; the snapshot payload is the entity's serialized form at that point in time. Restoring an old snapshot may leave new columns at their default values; documented behavior.
- [ ] **Snapshot dedup** — hash-based: a NodeVersion is not written if its content hash equals the latest version's hash for that (nodeType, nodeId). Prevents duplicate snapshots from no-op edits.

### Quality

- [ ] **Snapshot write completes within 50ms** for typical entities (under 100KB serialized).
- [ ] **Version list query returns within 100ms** for any node (covered by composite index on `(nodeType, nodeId, createdAt DESC)`).
- [ ] **Diff computation completes within 200ms** for typical block documents (under 50 blocks).
- [ ] **Time slider scrub feels instant** — daily snapshot fetch returns within 200ms; React Query 24h staleTime keeps repeat scrubs cache-warm.
- [ ] **Storage budget**: with 10k nodes × avg 50KB serialized × retention-policy steady-state (~110 versions/node max), cap is ~55GB worst case. Realistic working set after retention runs: 5-10GB. Documented in CLAUDE.md.
- [ ] **`tsc --noEmit` and `pnpm build` pass with zero errors at every commit.**
- [ ] **`ascend-security` audit on version routes: PASS.** userId scoping on every Prisma query touching `NodeVersion`, `EdgeEvent`, `GraphDailySnapshot`. Restore + branch operations re-check ownership of the source node before mutating.
- [ ] **`ascend-migration-auditor` PASS** on every migration. The Wave 7 migrations are additive (new tables + new enum values + a new ContextLink type) and never touch `search_vector`.
- [ ] **`ascend-architect` PASS** on the diff engine extraction. The pure-TS diff engine moves into `packages/diff/` so mobile (Wave 6) and desktop (Wave 9+) can reuse it.
- [ ] **`ascend-critic` verdict at GOOD or WORLD-CLASS at wave close.**
- [ ] **`ax:verify-ui` PASS** on: open an entry → edit → see new version appear in panel → diff against prior → restore → confirm restored content. Open the graph view → drag the time slider → confirm graph re-renders.

### Cross-platform readiness

- [ ] **Diff engine in `packages/diff/`** (new shared package) — pure TS, no DOM/Node imports. Mobile (Wave 6, when shipped) consumes it directly.
- [ ] **Versioning Zod schemas in `@ascend/core`** (`packages/core/src/schemas/versioning.ts`) so mobile reuses validators.
- [ ] **`workspaceId` (nullable) on `NodeVersion`, `EdgeEvent`, `GraphDailySnapshot`** so Wave 8 (workspaces + collaboration) can filter without a backfill. Defaults to `null` (treated as the user's "default workspace") in Wave 7; Wave 8 will populate.
- [ ] **MCP tools fully agent-usable** — every tool returns structured JSON with all the data needed for an agent to render or act on it (diffs include line numbers, version IDs are stable strings, restore returns the new version ID).

## Affected Layers

- **Prisma schema:**
  - **`NodeType` enum (NEW)**: `CONTEXT_ENTRY`, `GOAL`, `TODO`, `DATABASE_ROW`, `DATABASE_FIELD`.
  - **`VersionTrigger` enum (NEW)**: `EDIT_DEBOUNCED`, `EDIT_BLUR`, `EDIT_EXPLICIT`, `RESTORE`, `BRANCH`, `BACKFILL`, `MIGRATION`.
  - **`EdgeEventType` enum (NEW)**: `CREATED`, `REMOVED`, `UPDATED`.
  - **`ContextLinkType` enum extended** with `DERIVED_FROM` (used for branching).
  - **`NodeVersion` table (NEW)**: `id String @id @default(cuid())`, `userId String`, `workspaceId String?`, `nodeType NodeType`, `nodeId String`, `versionNumber Int` (monotonically increasing per node), `payload Json` (full serialized entity), `contentHash String` (sha256, hex), `byteSize Int`, `trigger VersionTrigger`, `parentVersionId String?` (for branches; null for normal sequential history), `createdAt DateTime @default(now())`. Indexes: `@@unique([nodeType, nodeId, versionNumber])`, `@@index([nodeType, nodeId, createdAt(sort: Desc)])`, `@@index([userId, createdAt(sort: Desc)])`, `@@index([contentHash])` (for dedup lookup), `@@index([workspaceId])`. CHECK constraint: `byte_size >= 0` and `byte_size <= 10485760` (10 MiB ceiling per snapshot).
  - **`EdgeEvent` table (NEW)**: `id String @id @default(cuid())`, `userId String`, `workspaceId String?`, `eventType EdgeEventType`, `linkSnapshot Json` (full ContextLink at event time, including fromEntryId, toEntryId, type, databaseFieldId, etc.), `createdAt DateTime @default(now())`. Indexes: `@@index([userId, createdAt(sort: Desc)])`, `@@index([workspaceId])`. Optional denormalized `fromEntryId` / `toEntryId` columns for fast "edges involving entry X over time" queries — TBD in Phase 1 review.
  - **`GraphDailySnapshot` table (NEW)**: `id String @id @default(cuid())`, `userId String`, `workspaceId String?`, `snapshotDate Date` (UTC midnight), `nodes Json` (array of node summaries), `edges Json` (array of edge summaries), `nodeCount Int`, `edgeCount Int`, `createdAt DateTime @default(now())`. Indexes: `@@unique([userId, snapshotDate])`, `@@index([snapshotDate])`. CHECK: `octet_length(nodes::text) + octet_length(edges::text) <= 5242880` (5 MiB ceiling per daily snapshot).

- **Packages:**
  - **`@ascend/core` (`packages/core/src/schemas/versioning.ts` NEW)**: `nodeVersionPayloadSchema` (a discriminated union by nodeType matching the entity's known shape; tolerant of unknown fields for forward-compat), `versionTriggerEnum`, `edgeEventTypeEnum`, `nodeTypeEnum`. Re-exported into `apps/web/lib/validations.ts`.
  - **`@ascend/diff` (`packages/diff/`, NEW package)** — pure-TS diff engine. Subpackages: `block-diff.ts` (Lexical-state-aware: walks the JSON snapshot tree, identifies added/removed/moved/modified blocks via stable IDs, recurses into modified text nodes with `fast-diff`-style line+word diff), `field-diff.ts` (object-level diff for entity metadata), `property-diff.ts` (typed-property diff for DatabaseRow), `text-diff.ts` (line + word diff over plain strings). Exports `diffNodeVersions(fromPayload, toPayload, nodeType): DiffResult`. Round-trip tested against a fixture set of before/after pairs in `packages/diff/test-fixtures/`.

- **Service layer (`apps/web/lib/services/`):**
  - **`versioningService.ts` (new)** — orchestrator. `scheduleSnapshot(userId, nodeType, nodeId, trigger)` enqueues a debounced snapshot. `flushPendingSnapshots(userId?)` drains the in-process debounce map. `createSnapshot(userId, nodeType, nodeId, trigger, parentVersionId?)` reads the live entity, serializes it, hashes, dedups, writes a `NodeVersion`. `listVersions(userId, nodeType, nodeId, opts)`, `getVersion(userId, versionId)`. Owns the in-process debounce map (`Map<string, NodeJS.Timeout>`); on serverless cold-start the map is empty (best-effort; the EDIT_BLUR trigger guarantees at-least-once snapshot per session).
  - **`diffService.ts` (new)** — wraps `@ascend/diff` for service-level use. `diffVersions(userId, fromVersionId, toVersionId): DiffResult`. Verifies both versions belong to the same node and same user before diffing.
  - **`restoreService.ts` (new)** — `restore(userId, versionId, dryRun?)`. Reads the target version, fetches the live entity, dispatches per nodeType to the right service to overwrite (`contextService.update`, `goalService.update`, etc.), then schedules a `RESTORE`-triggered snapshot. Returns `{ restoredVersionId, newVersionId, warnings: ["edges not time-traveled", ...] }`. `dryRun: true` returns the payload that would be written without touching the DB.
  - **`branchService.ts` (new)** — `branch(userId, versionId, title)`. Validates the source nodeType is branch-eligible (CONTEXT_ENTRY of branchable subtypes, or DATABASE_ROW). Creates a new entity via the appropriate service, copies the snapshot payload (excluding the original's primary key + timestamps), creates a `DERIVED_FROM` ContextLink (new node → original node, with the source versionId as metadata in the link's `databaseFieldId` field's repurposed `metadata` JSONB if added — TBD in Phase 1 review). Cycle detection: walks `DERIVED_FROM` chain backward from the source; refuses if branching would create a cycle.
  - **`edgeEventService.ts` (new)** — `logCreated(userId, link)`, `logRemoved(userId, link)`, `logUpdated(userId, before, after)`. Hooked into every write path in `apps/web/lib/services/context-link-service.ts`. Same userId-scoping rules.
  - **`graphHistoryService.ts` (new)** — `getGraphAt(userId, date): GraphPayload`. If date is "today" or future → delegates to existing `contextService.getGraph`. If date is in the past → looks up `GraphDailySnapshot` for that user + UTC midnight; returns the stored payload; throws if outside the 90-day window.
  - **`graphSnapshotService.ts` (new)** — `precomputeDailySnapshot(userId, date)`. Builds the graph at the given date by walking `NodeVersion` (latest version per node ≤ date) + `EdgeEvent` (replay edge events ≤ date). Idempotent (upserts on `(userId, snapshotDate)`).
  - **`retentionCompactorService.ts` (new)** — `compactUserVersions(userId)`. Walks NodeVersion grouped by (nodeType, nodeId); applies the 30-day-all → 30-day-1/day → 1/week-forever policy; deletes surplus rows. Returns count deleted.

- **Snapshot triggers (wired into existing services):**
  - `apps/web/lib/services/context-service.ts` — `update`, `delete` call `versioningService.scheduleSnapshot` after a successful write. `delete` writes a tombstone snapshot first (so the version remains visible) then deletes.
  - `apps/web/lib/services/block-document-service.ts` — `persistSnapshot` (existing, called by editor autosave) calls `versioningService.scheduleSnapshot` for the parent ContextEntry.
  - `apps/web/lib/services/goal-service.ts` — `update`, `delete`, `complete` schedule snapshots.
  - `apps/web/lib/services/todo-service.ts` — `update`, `delete`, `complete` schedule snapshots.
  - `apps/web/lib/services/database-row-service.ts` — `update`, `delete` schedule snapshots.
  - `apps/web/lib/services/database-field-service.ts` — `update`, `delete`, `changeType`, `reorder` schedule snapshots.
  - `apps/web/lib/services/context-link-service.ts` — every write path additionally calls `edgeEventService.logCreated/Removed/Updated`.

- **API routes (`apps/web/app/api/versions/`):**
  - `GET /api/versions/[nodeType]/[nodeId]` — list versions (paginated). Query params: `limit`, `cursor`.
  - `GET /api/versions/[id]` — fetch a single version (full payload).
  - `POST /api/versions/diff` — body `{ fromVersionId, toVersionId }` → returns `DiffResult`.
  - `POST /api/versions/restore` — body `{ versionId, dryRun? }` → restores or returns the proposed payload.
  - `POST /api/versions/branch` — body `{ versionId, title }` → creates new node + DERIVED_FROM edge.
  - `GET /api/graph/at` — query `?date=YYYY-MM-DD` → returns `GraphPayload` (extends the existing graph contract).
  - `POST /api/versions/compact` — cron-only (CRON_SECRET header), no user JWT. Runs the retention compactor for all users.
  - `POST /api/graph/snapshots/precompute` — cron-only, runs the daily snapshot computation for all users for yesterday's date.

- **React Query hooks (`apps/web/lib/hooks/use-versions.ts`):**
  - `useVersions(nodeType, nodeId, opts?)`, `useVersion(versionId)`, `useDiff(fromVersionId, toVersionId)`, `useRestore()`, `useBranch()`, `useGraphAt(date)`.
  - Cache keys: `queryKeys.versions.list(nodeType, nodeId)`, `queryKeys.versions.detail(versionId)`, `queryKeys.versions.diff(from, to)`, `queryKeys.graph.at(date)`.
  - Cross-domain invalidation on `useRestore.onSuccess`: invalidates `queryKeys.context.*` (or goals/todos/database depending on nodeType) AND `queryKeys.versions.list(nodeType, nodeId)` AND `queryKeys.context.graph` AND `queryKeys.dashboard()`.
  - `useGraphAt` has 24h staleTime (snapshots are immutable per date).

- **UI components (`apps/web/components/versioning/`, NEW):**
  - **`version-history-panel.tsx`** — collapsible "N versions" list. Default collapsed; expands to show last 20 versions with createdAt + trigger badge. "Show all" reveals full pagination. Each row: timestamp, trigger reason, "Diff vs current" + "Restore" + (if branchable) "Branch" inline buttons.
  - **`version-diff-modal.tsx`** — full-screen modal. Header: version selector (left + right) and "Restore" + "Branch" actions. Body: type-aware diff renderer mounted via switch on nodeType.
  - **`diff-renderers/` subfolder** — one component per nodeType:
    - `block-diff-renderer.tsx` — renders block-level diff with added/removed/moved badges per block, expanded text-diff inside modified blocks.
    - `field-diff-renderer.tsx` — generic key/value table for ContextEntry/Goal/Todo metadata.
    - `property-diff-renderer.tsx` — per-property table for DatabaseRow with type-aware value diff.
    - `field-config-diff-renderer.tsx` — for DatabaseField config changes (type changes, options added/removed).
  - **Mounting:**
    - `apps/web/components/context/context-entry-detail.tsx` — `<VersionHistoryPanel nodeType="CONTEXT_ENTRY" nodeId={entry.id} />` mounted below the block editor body.
    - `apps/web/components/goals/goal-detail.tsx` — same with `nodeType="GOAL"`.
    - `apps/web/components/todos/todo-detail.tsx` — same with `nodeType="TODO"`.
    - `apps/web/components/databases/database-row-properties.tsx` — same with `nodeType="DATABASE_ROW"`.
    - DatabaseField history is surfaced via a kebab item on the field header in Table view (not a panel; field history is a power-user view).

- **Graph view extensions:**
  - `apps/web/components/context/context-graph-time-slider.tsx` — overlay above the graph canvas. Horizontal slider, last 90 days. Shows current date + "Now" label at the right. Reduced-motion-aware (instant snap when reduce-motion is set).
  - `apps/web/components/context/context-graph-view.tsx` — modified to accept an optional `atDate` prop. When set, fetches via `useGraphAt(date)`; when null/today, uses live `useContextGraph()`. Visual indicator banner when `atDate < today`: "Viewing graph as it was on D. M. YYYY. Edits disabled. [Return to now]".
  - Branching action: kebab item on node detail and on the diff modal → opens `branch-dialog.tsx` (title input + confirm).

- **Branching UI:**
  - `apps/web/components/versioning/branch-dialog.tsx` — title input, source preview, "Create branch" button. Surfaces a warning if the source already has > 5 derivatives.

- **MCP tools (`apps/web/lib/mcp/tools/version-tools.ts`, NEW):**
  - `list_versions(nodeType, nodeId, limit?)` — last 20 by default; supports cursor pagination.
  - `get_version(versionId)` — returns full payload + metadata.
  - `diff_versions(fromVersionId, toVersionId)` — returns DiffResult (structured per nodeType).
  - `restore_version(versionId, dryRun?)` — restores or previews.
  - `branch_node(versionId, title)` — creates branch.

- **Zustand store:** `lib/stores/ui-store.ts` extended with `versionHistoryExpanded: Record<string, boolean>` (per-node panel collapse state, persisted via `@ascend/storage`) and `graphViewAtDate: string | null` (current time-slider position; not persisted — defaults to null = "now" on each load).

- **Cron / queues:**
  - **Nightly retention compactor** — `.github/workflows/version-retention.yml`, runs at 03:00 UTC, hits `POST /api/versions/compact` with `x-cron-secret`.
  - **Nightly daily-snapshot precompute** — `.github/workflows/graph-daily-snapshot.yml`, runs at 03:30 UTC (after compactor), hits `POST /api/graph/snapshots/precompute` for yesterday's date.
  - **Backfill** — one-shot script `apps/web/scripts/backfill-versions.ts` runs once during the Wave 7 migration. Idempotent.

## Data Model Changes

```prisma
enum NodeType {
  CONTEXT_ENTRY
  GOAL
  TODO
  DATABASE_ROW
  DATABASE_FIELD
}

enum VersionTrigger {
  EDIT_DEBOUNCED
  EDIT_BLUR
  EDIT_EXPLICIT
  RESTORE
  BRANCH
  BACKFILL
  MIGRATION
}

enum EdgeEventType {
  CREATED
  REMOVED
  UPDATED
}

enum ContextLinkType {
  // ... existing 10 values (after Wave 5 added DATABASE_RELATION)
  DERIVED_FROM  // NEW — derived from a branch operation
}

model NodeVersion {
  id              String         @id @default(cuid())
  userId          String
  workspaceId     String?        // Wave 8 prep
  nodeType        NodeType
  nodeId          String
  versionNumber   Int
  payload         Json
  contentHash     String
  byteSize        Int
  trigger         VersionTrigger
  parentVersionId String?        // null for sequential history; set for branches
  createdAt       DateTime       @default(now())

  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  parentVersion   NodeVersion?   @relation("VersionParent", fields: [parentVersionId], references: [id], onDelete: SetNull)
  childVersions   NodeVersion[]  @relation("VersionParent")

  @@unique([nodeType, nodeId, versionNumber])
  @@index([nodeType, nodeId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@index([contentHash])
  @@index([workspaceId])
}

model EdgeEvent {
  id            String        @id @default(cuid())
  userId        String
  workspaceId   String?       // Wave 8 prep
  eventType     EdgeEventType
  linkSnapshot  Json
  fromEntryId   String?       // denormalized for fast lookup
  toEntryId     String?       // denormalized for fast lookup
  createdAt     DateTime      @default(now())

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@index([workspaceId])
  @@index([fromEntryId, createdAt(sort: Desc)])
  @@index([toEntryId, createdAt(sort: Desc)])
}

model GraphDailySnapshot {
  id            String   @id @default(cuid())
  userId        String
  workspaceId   String?  // Wave 8 prep
  snapshotDate  DateTime @db.Date
  nodes         Json
  edges         Json
  nodeCount     Int
  edgeCount     Int
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, snapshotDate])
  @@index([snapshotDate])
  @@index([workspaceId])
}
```

CHECK constraints (hand-written in raw SQL migration; not expressible in Prisma schema):

```sql
ALTER TABLE "NodeVersion"
  ADD CONSTRAINT "NodeVersion_byteSize_positive" CHECK ("byteSize" >= 0),
  ADD CONSTRAINT "NodeVersion_byteSize_max" CHECK ("byteSize" <= 10485760);

ALTER TABLE "GraphDailySnapshot"
  ADD CONSTRAINT "GraphDailySnapshot_size_max" CHECK (
    octet_length("nodes"::text) + octet_length("edges"::text) <= 5242880
  );
```

Migration order:
1. `20260505000001_add_node_version` — `NodeType` + `VersionTrigger` enums; `NodeVersion` table; CHECK constraints; indexes.
2. `20260505000002_add_edge_event` — `EdgeEventType` enum; `EdgeEvent` table; indexes.
3. `20260505000003_add_graph_daily_snapshot` — `GraphDailySnapshot` table; CHECK constraint; indexes.
4. `20260505000004_add_derived_from_link_type` — extends `ContextLinkType` enum with `DERIVED_FROM`.

All four are additive. None touch `search_vector`. All hand-written per safety rule 6.

Then: `apps/web/scripts/backfill-versions.ts` runs as a separate post-migration step (manual `pnpm tsx` or one-shot endpoint with cron-secret guard). Idempotent.

## API Contract

### `GET /api/versions/[nodeType]/[nodeId]`

Lists versions for a node, newest first. Userid-scoped (auth required).

Query params: `limit` (default 20, max 100), `cursor` (versionId).

Response:
```json
{
  "versions": [
    {
      "id": "ckxxxxx",
      "versionNumber": 42,
      "trigger": "EDIT_DEBOUNCED",
      "byteSize": 12345,
      "createdAt": "2026-05-04T16:30:00Z",
      "parentVersionId": null
    }
  ],
  "nextCursor": "ckxxxxx" // null if no more
}
```

### `GET /api/versions/[id]`

Fetches a single version including the full payload.

Response:
```json
{
  "id": "ckxxxxx",
  "userId": "ck...",
  "workspaceId": null,
  "nodeType": "CONTEXT_ENTRY",
  "nodeId": "ck...",
  "versionNumber": 42,
  "payload": { /* full serialized entity */ },
  "contentHash": "sha256:abc...",
  "byteSize": 12345,
  "trigger": "EDIT_DEBOUNCED",
  "parentVersionId": null,
  "createdAt": "2026-05-04T16:30:00Z"
}
```

### `POST /api/versions/diff`

Body: `{ "fromVersionId": "ck...", "toVersionId": "ck..." }`.

Response:
```json
{
  "nodeType": "CONTEXT_ENTRY",
  "nodeId": "ck...",
  "from": { "id": "ck...", "versionNumber": 41, "createdAt": "..." },
  "to": { "id": "ck...", "versionNumber": 42, "createdAt": "..." },
  "diff": {
    "kind": "block-diff",
    "blocks": [
      { "blockId": "abc", "change": "modified", "textDiff": [...] },
      { "blockId": "def", "change": "added", "block": {...} },
      { "blockId": "ghi", "change": "removed", "block": {...} }
    ]
  }
}
```

`diff.kind` values: `"block-diff"`, `"field-diff"`, `"property-diff"`, `"field-config-diff"` — discriminated union.

### `POST /api/versions/restore`

Body: `{ "versionId": "ck...", "dryRun": false }`.

Response (success, dryRun=false):
```json
{
  "restoredVersionId": "ck...",
  "newVersionId": "ck...",
  "warnings": ["Edges (ContextLinks) are not time-traveled. Current relationships preserved."]
}
```

Response (dryRun=true):
```json
{
  "previewPayload": { /* what would be written */ },
  "warnings": [...]
}
```

### `POST /api/versions/branch`

Body: `{ "versionId": "ck...", "title": "..." }`.

Response:
```json
{
  "newNodeId": "ck...",
  "newVersionId": "ck...",
  "derivedFromLinkId": "ck..."
}
```

### `GET /api/graph/at?date=YYYY-MM-DD`

Returns the graph as it was at midnight UTC on the given date. Date must be within the last 90 days; older returns 410 Gone.

Response shape matches the existing `GET /api/context/graph` (nodes + edges arrays).

### `POST /api/versions/compact` (cron-only)

Header: `x-cron-secret: <CRON_SECRET>`. Runs the retention compactor across all users. Returns `{ usersProcessed, versionsDeleted }`.

### `POST /api/graph/snapshots/precompute` (cron-only)

Header: `x-cron-secret: <CRON_SECRET>`. Computes yesterday's daily snapshot for all users. Returns `{ usersProcessed, snapshotsWritten }`.

## UI Flows

### Viewing version history

1. User opens any entry detail panel (note, goal, todo, database row).
2. Below the editor body (or properties panel for rows), the `VersionHistoryPanel` renders collapsed showing "12 versions" + chevron.
3. Click chevron → expands to show the 20 most recent versions: timestamp ("3 hours ago"), trigger badge ("Auto-saved" / "Restored" / "Branched"), three inline actions: "Diff", "Restore", "Branch" (the latter only on branchable types).
4. Click a version row → opens `VersionDiffModal` showing the diff between that version and the current state.

### Restoring a version

1. In the diff modal or panel, click "Restore" on the desired version.
2. Confirmation dialog appears: "Restore this version? Current edges (links to other entries) will NOT be reverted. The current state will be saved as a new version before restore." Buttons: Cancel / Restore.
3. Confirm → API call → on success, toast: "Restored version 41". The detail panel re-fetches; the version panel shows two new entries: the auto-snapshot before restore, and the RESTORE-triggered snapshot.

### Branching a version

1. In the diff modal or panel kebab, click "Branch from this version".
2. Dialog opens: title input pre-filled with `"<original title> (branch)"`. Source preview shown. Warning if branchable type already has > 5 derivatives.
3. Confirm → new entry created with same type + payload + a `DERIVED_FROM` ContextLink back to the original. Detail panel navigates to the new entry (same way "open created entry" works elsewhere). Confetti fires (small burst, similar to first-row-created).

### Time slider on graph view

1. User opens `/context` → switches to Graph view.
2. Above the canvas, a horizontal time slider renders with the right edge at "Now" and the left edge at "90 days ago". Tick marks every 7 days.
3. Drag the slider → graph re-renders showing nodes + edges that existed on that date. Banner appears: "Viewing graph as it was on 12. 4. 2026. Edits disabled."
4. Click "Return to now" pill → slider snaps to right; banner disappears; graph re-renders live state.

### Auto-snapshot during editing

1. User edits a note in the block editor.
2. After 60 seconds of inactivity (or on blur, navigation, explicit save), a snapshot is created.
3. The version panel does not auto-expand or interrupt; the user can later expand to see the new entry.
4. If two consecutive snapshots have identical content hashes, only the first is kept (dedup).

## Cache Invalidation

| Mutation | Invalidates |
|---|---|
| `useRestore` | `queryKeys.versions.list(nodeType, nodeId)`, `queryKeys.versions.detail(*)` (the new restore-snapshot's id is unknown at fire time, so list invalidation drives refetch); plus per-nodeType target: `queryKeys.context.detail(nodeId)` + `queryKeys.context.list()` + `queryKeys.context.search` (for CONTEXT_ENTRY); `queryKeys.goals.detail(nodeId)` + `queryKeys.goals.all()` + `queryKeys.dashboard()` (for GOAL); `queryKeys.todos.detail(nodeId)` + `queryKeys.todos.all()` + `queryKeys.dashboard()` (for TODO); `queryKeys.databases.row(nodeId)` + `queryKeys.databases.rows(databaseId)` (for DATABASE_ROW); `queryKeys.databases.fields(databaseId)` (for DATABASE_FIELD). Always: `queryKeys.context.graph` (because graph node payload may have changed). |
| `useBranch` | `queryKeys.versions.list(originalNodeType, originalNodeId)` (the original gets a new outgoing DERIVED_FROM edge); plus `queryKeys.context.list()` + `queryKeys.context.graph` + `queryKeys.contextLinks.all()` (because a new node + a new edge were created). |
| Implicit snapshots from existing mutations (block edit, goal update, etc.) | The mutating service still fires its existing invalidations. Additionally invalidates `queryKeys.versions.list(nodeType, nodeId)` (the version panel needs to re-render with the new entry, but only after the debounce flushes — so this invalidation is fired by `versioningService.createSnapshot`'s response handler, not by the originating mutation). |
| Time slider date change | `useGraphAt(date)` is a query, not a mutation. Cache key includes the date; React Query handles cache hits/misses naturally. 24h staleTime per date. |

## Danger Zones Touched

This wave introduces 4 new danger zones. None of the existing DZ-1 through DZ-16 are directly affected, but DZ-2 (search_vector) discipline is preserved by hand-writing every migration.

- **DZ-17 (NEW): Snapshot storage runaway.** A pathological actor could edit a node every 60 seconds for 24 hours = 1440 snapshots × N nodes × payload size. Even with 1MB block doc cap, 1440 × 1MB × 100 nodes = 144 GB / day worst case. Mitigations: (a) debounce window means actual writes are bounded by user activity, not edit count; (b) hash-based dedup skips no-op snapshots; (c) per-snapshot 10 MiB CHECK constraint; (d) retention compactor caps steady-state at ~110 versions/node/year forever; (e) future: per-user daily snapshot count cap (defer to BACKLOG; single-user prod has natural ceiling).

- **DZ-18 (NEW): Restore semantics on cross-references and cascading state.** Restoring a ContextEntry to v3 may reference wikilinks to entries that no longer exist or have changed type. Restoring a Todo's `goalId` to a deleted goal would FK-fail. Mitigations: (a) restore writes the payload field-by-field via the target service, which validates FKs and returns clear errors; (b) ContextLinks are NOT time-traveled (current edges remain); (c) the restore confirmation dialog explicitly states this; (d) restore returns a `warnings` array with any references that could not be resolved; (e) for orphaned wikilinks, the rendered note shows broken-link badges (existing behavior); (f) `dryRun: true` lets clients (or AI agents) preview before committing.

- **DZ-19 (NEW): "Graph as it was" performance + correctness.** Querying graph at date X without precomputed snapshots requires per-node "find latest version ≤ date" + per-edge "replay all events ≤ date" — easily O(N+E) database round-trips. Mitigations: (a) `GraphDailySnapshot` precomputes the graph at midnight UTC daily; (b) the slider is 90-day capped (older requires a future feature); (c) `useGraphAt` has 24h staleTime so repeat scrubs are cache-hits; (d) precompute cron runs nightly at 03:30 UTC (after retention compactor at 03:00); (e) snapshots are denormalized to whatever fields the graph view needs (id, label, type, color, position) — not full payloads — so individual snapshots stay under 5 MiB CHECK constraint; (f) if a user has > 90 days history but the precompute cron fails, the graph view falls back to live state with a "Time slider unavailable: snapshots not yet computed" banner.

- **DZ-20 (NEW): Branching circularity and runaway derivation.** A user could branch A → B, then branch B → C, then branch C → A (creating a cycle in DERIVED_FROM edges). Or branch a node 1000 times. Mitigations: (a) cycle detection at branch time: walks DERIVED_FROM chain backward from the source for up to 100 hops, refuses if the source's ancestor chain contains the would-be parent; (b) soft warning at > 5 derivatives ("This node already has 6 branches — are you sure?"); (c) hard cap of 50 direct derivatives per source node (configurable; defer to settings later).

## Out of Scope

- **Merging branches.** Branching is one-way in Wave 7. Merge UI + diff-based merge tooling is Wave 8 collaboration territory.
- **Real-time collaboration on a single document.** Wave 8.
- **User attribution beyond `createdBy = userId`.** Multi-user attribution + change author display is Wave 8.
- **Search across versions.** "Find a note that mentioned X last quarter" requires a separate full-text index over historical payloads. Defer to a future polish wave.
- **Versioning of `Category`, `UserStats`, `XpEvent`, `ProgressLog`, `BlockDocument` (as standalone), `LlmUsage`, `ContextMap`, `File`, `ExtractionJob`.** These are either ephemeral, log-shaped, or wholly contained inside a parent that IS versioned (BlockDocument inside ContextEntry). If a need arises later, the polymorphic NodeVersion table makes adding new types cheap.
- **Time slider on views other than graph.** Calendar, Table, Board, Gallery, Timeline views remain "live only". Future polish.
- **Graph time slider beyond 90 days.** Hard limit in v1; can be lifted by extending the precompute backfill window if needed.
- **Per-user retention policy customization.** Hard-coded in v1 (30 → 30 → forever-1/week). Surface in settings later if requested.
- **Diff for `ContextLink` mutations on its own.** EdgeEvents are stored, but the UI for viewing edge history is deferred. The graph time slider implicitly visualizes edge history via the daily snapshots.
- **`User.role` migration + admin-only routes.** Wave 7 adds 2 cron-secret-protected routes; the admin-only-via-JWT pattern is left for the User.role wave.
- **Mobile UI (`apps/mobile`).** Wave 6 (whenever shipped) consumes the API + diff package; no Wave 7 UI work targets mobile.

## Open Questions

1. **Should `EdgeEvent` denormalize `fromEntryId` and `toEntryId` for index-friendly lookup of "edges involving entry X over time"?** Recommendation: yes (cheap, makes future per-entry edge history features fast). Decided in Phase 1 review with the migration auditor.
2. **Snapshot trigger for `BlockDocument` autosave currently fires on every persist. Should it be coupled to the debounce window, or should the editor's existing 1.5s autosave debounce be the trigger?** Recommendation: the editor's autosave is fine; we just hook into the post-persist callback and let the versioning service apply the additional 60s debounce on top. Two-stage debounce. Decided in Phase 5 (snapshot triggers wiring).
3. **For the diff modal's left-vs-right pane on narrow viewports**, do we collapse to tabbed layout (older/diff/newer) or vertical stack? Recommendation: tabbed below ~768px. Confirm with `ascend-ux` review.
4. **Should `restore` allow targeting a specific older version OR force the restore to ALWAYS write a forward snapshot first (current state preserved as a version) regardless of dedup?** Recommendation: forward snapshot is mandatory and bypasses dedup (so the user can always "undo restore" by restoring the auto-saved-before-restore version). Confirm in Phase 6.
5. **Should the time slider on graph view be 90 days, 180, or 365?** Recommendation: 90 in v1 (bounded storage). Configurable later.
6. **Should `/api/versions/diff` accept `fromVersionId: null` to mean "vs current"?** Recommendation: yes, for ergonomic diff-against-current from the panel. Implemented as `from = null → current state derived from live entity`. Confirm in Phase 7.

## Success Test (smoke at wave close)

Manual smoke (5-10 minutes, after `/ax:verify-ui` passes):

1. Open an existing note. Edit two paragraphs. Wait 60s. Confirm a new version appears in the panel.
2. Edit again. Hit Cmd+S (explicit save). Confirm a new version with trigger `EDIT_EXPLICIT` appears immediately.
3. Diff against an older version. Confirm block-level diff renders with added/removed/modified badges.
4. Restore the older version. Confirm content reverts; confirm two new entries appear (auto-snapshot + RESTORE-triggered).
5. Branch from a version. Confirm new note opens with copied content + DERIVED_FROM edge visible in the edges panel.
6. Open `/context` graph view. Drag the time slider back 14 days. Confirm graph re-renders with fewer nodes (whatever existed then). Confirm "Viewing past state" banner. Click "Return to now". Confirm live graph returns.
7. Open a Goal detail. Edit description. Wait 60s. Confirm a Goal version appears.
8. Open a DatabaseRow detail. Edit a property. Wait 60s. Confirm a row version appears.
9. Via MCP: `list_versions(nodeType: "CONTEXT_ENTRY", nodeId: <id>)` returns the version list. `diff_versions(fromVersionId, toVersionId)` returns the structured diff. `restore_version(versionId, dryRun: true)` returns a payload preview. `branch_node(versionId, title)` creates a new node.
10. Confirm the nightly retention compactor ran (check application logs or query NodeVersion counts). Confirm yesterday's `GraphDailySnapshot` row exists.
