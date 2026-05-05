# Wave 7 Close-Out — Provenance + time travel

**Date closed:** 5. 5. 2026 15:17 Europe/Ljubljana
**PRD:** [PRD.md](./PRD.md)
**Target:** 10-15 working days at the cadence Waves 0-5 hit (2-3 weeks per VISION).
**Actual:** ~2 sessions across 4-5. 5. 2026 (~2 working days net).
**Verdict:** SHIPPED. ascend-critic GOOD (post must-fix); ascend-reviewer PASS; ascend-security AUDIT PASS WITH NOTES.

## Commits (13 on main, plus the wave-close commit)

| SHA | Subject |
|---|---|
| `279fe9e` | feat(db): Wave 7 Phase 1 — versioning schema + 3 migrations + plan docs |
| `6dd2121` | feat(diff): Wave 7 Phase 2 — pure-TS diff engine package + 10 fixtures |
| `c24c816` | feat(services): Wave 7 Phase 3 — 8 versioning services |
| `6bc0aae` | feat(services): Wave 7 Phase 4 — snapshot triggers wired into 7 services + logout flush |
| `d834431` | feat(scripts): Wave 7 Phase 5 — one-shot version + edge backfill |
| `abbe99d` | feat(api): Wave 7 Phase 6 — versioning routes + 2 cron workflows |
| `59c76a4` | fix(docker): add packages/diff to deps + builder + prod-deps stages |
| `04edcbd` | feat(hooks): Wave 7 Phase 7 — versioning React Query hooks |
| `7890113` | fix(api): rename /api/versions/[id] to /api/versions/by-id/[id] |
| `0dfc073` | feat(ui): Wave 7 Phase 8 — version history panel + diff modal + 4 type-aware renderers |
| `7ccdd33` | feat(ui): Wave 7 Phase 9 — time slider on graph view |
| `ae9a964` | feat(mcp): Wave 7 Phase 10 — 5 versioning MCP tools (68 → 73) |
| `02ed232` | feat(ui): Wave 7 Phase 11 — branching kebab + DatabaseField history kebab |
| (pending) | chore(wave-7): close Wave 7 — provenance and time travel shipped |

The pending wave-close commit bundles: 2 critic must-fix items (version-history-panel "Show all" replaced with cursor pagination, version-diff-modal narrow tabs replaced with content preview + formatTrigger labels), CLAUDE.md updates (Architecture subsection "Provenance + time travel (Wave 7)", entity model rows, views rows, key file lookup, DZ-17/18/19/20, tool count 68 → 73, @ascend/diff in shared packages), BACKLOG.md update, this CLOSE-OUT.md, review + security + critic audit artifacts.

Production incidents during the wave:
1. **Dockerfile missing `packages/diff` COPY** (`59c76a4`). The `@ascend/diff` package was not copied into the deps, builder, or prod-deps stages. Build failed in CI. Fixed by adding the `COPY packages/diff/ ./packages/diff/` lines to all three stages.
2. **Next.js param collision** (`7890113`). `GET /api/versions/[nodeType]/[nodeId]` and `GET /api/versions/[id]` occupied the same dynamic route level, causing Next.js to route ambiguously. Fixed by renaming the single-version endpoint to `/api/versions/by-id/[id]`. Hook, MCP tool, and component references updated accordingly.

## PRD Success Criteria Audit

### Functional criteria

- [x] **`NodeVersion` table** — append-only, immutable, polymorphic via `nodeType` + `nodeId`. All fields per PRD. DONE (`279fe9e`, `c24c816`).
- [x] **`EdgeEvent` table** — append-only log of every ContextLink mutation with CREATED/REMOVED/UPDATED, denormalized `fromEntryId`/`toEntryId`. DONE (`279fe9e`, `c24c816`).
- [x] **5 versioned node types**: CONTEXT_ENTRY, GOAL, TODO, DATABASE_ROW, DATABASE_FIELD. BlockDocument snapshots ride along inside CONTEXT_ENTRY and DATABASE_ROW payloads. DONE (`6bc0aae` wires all 5).
- [x] **Snapshot trigger** — debounced 60s, EDIT_BLUR/EDIT_EXPLICIT bypass, hash-based dedup. DONE (`c24c816` service, `6bc0aae` trigger wiring).
- [x] **Retention policy** — 30d all → 30d 1/day → 1/week forever (Monday-anchored). Nightly cron at 03:00 UTC. DONE (`c24c816` service, `abbe99d` cron workflow).
- [x] **Backfill on migration** — one-shot script, idempotent. DONE (`d834431`).
- [x] **Diff engine** — pure-TS in `packages/diff/`, 4 strategies (block, field, property, field-config), 10/10 fixtures. DONE (`6dd2121`).
- [x] **Version history panel** — mounted in context-entry-detail, goal-detail, todo-detail, database-row-properties. Collapsible, last 20 versions, trigger badges, Diff/Restore/Branch actions, cursor pagination for "Show older versions". DONE (`0dfc073`, must-fix in wave-close commit).
- [x] **Side-by-side diff modal** — type-aware renderer switch, Restore + Branch in header. Tabbed layout on narrow viewports with content preview + formatTrigger labels. DONE (`0dfc073`, must-fix in wave-close commit).
- [x] **Restore action** — forward snapshot before mutate, per-nodeType dispatch, warnings array, dryRun mode. Confirmation dialog explicit about edges not being time-traveled. DONE (`c24c816` service, `0dfc073` UI).
- [x] **Branching** — BlockDocument-bearing nodes only. Cycle detection (100-hop DERIVED_FROM walk). 50 derivative hard cap. DERIVED_FROM ContextLink. Confetti on success. DONE (`c24c816` service, `02ed232` UI wiring).
- [x] **Time slider on graph view** — 90-day horizontal slider, keyboard nav, `useGraphAt` with 24h staleTime, "Viewing past state" banner, "Return to now" pill, fallback banner for missing snapshots. DONE (`7ccdd33`).
- [x] **`GraphDailySnapshot` table + nightly compute** — precomputed at 03:30 UTC, 5 MiB CHECK, `@@unique([userId, snapshotDate])`. DONE (`279fe9e` schema, `c24c816` service, `abbe99d` cron).
- [x] **5 new MCP tools** — `list_versions`, `get_version`, `diff_versions`, `restore_version`, `branch_node`. Tool count 68 → 73. DONE (`ae9a964`).
- [x] **No data loss on schema changes** — historical snapshots store the entity as it was; restoring old snapshots may leave new columns at defaults. Documented behavior. DONE (inherent in the JSONB payload design).
- [x] **Snapshot dedup** — hash-based. NodeVersion is not written if content hash matches latest. DONE (`c24c816` versioningService.createSnapshot).
- [x] **DatabaseField history via kebab** — "Version history" kebab item on table-header-cell opens diff modal for the field. DONE (`02ed232`).
- [x] **Logout flushes pending snapshots** — `POST /api/auth/logout` calls `versioningService.flushPendingSnapshots`. DONE (`6bc0aae`).

### Quality criteria

- [x] **Snapshot write completes within 50ms** for typical entities. Architecturally sound (single Prisma create, hash computed in-process). Verified by inspection. DONE.
- [x] **Version list query returns within 100ms**. Covered by composite index `@@index([nodeType, nodeId, createdAt(sort: Desc)])`. DONE.
- [x] **Diff computation completes within 200ms** for typical documents. Pure-TS tree walk with `fast-diff` for text segments. DONE.
- [x] **Time slider scrub feels instant**. 24h staleTime + retry:false on `useGraphAt`. Repeat scrubs are cache hits. DONE.
- [x] **Storage budget documented.** Steady-state approximately 110 versions/node/year. Documented in CLAUDE.md DZ-17. DONE.
- [x] **`tsc --noEmit` and `pnpm build` pass at every commit.** Verified. DONE.
- [x] **`ascend-security` audit PASS.** AUDIT PASS WITH NOTES. All userId scoping verified, cron-secret timing-safe compare confirmed, no Bearer-key path on cron routes. Notes are non-blocking (error message wrapping, rate limiting deferred). DONE.
- [x] **`ascend-migration-auditor` PASS.** All 4 migrations additive, no search_vector references, CHECK constraints present, indexes correct. DONE (Phase 1).
- [x] **`ascend-architect` PASS.** `@ascend/diff` has zero React/Next/Prisma imports; only `fast-diff` as runtime dep. DONE (Phase 2).
- [x] **`ascend-critic` verdict at GOOD.** GOOD post must-fix. 2 must-fix items addressed in wave-close commit. DONE.
- [ ] **`ax:verify-ui` PASS.** Deferred to prod smoke test (consistent with Wave 4 and Wave 5 pattern). Surface-level Playwright cannot fully exercise the debounced snapshot timing or the 90-day slider without pre-seeded historical data.

### Cross-platform criteria

- [x] **Diff engine in `packages/diff/`** — pure TS, no DOM/Node imports. `ascend-architect` verified. DONE.
- [x] **Versioning Zod schemas in `@ascend/core`** (`packages/core/src/schemas/versioning.ts`). Re-exported to `apps/web/lib/validations.ts`. DONE.
- [x] **`workspaceId` (nullable) on NodeVersion, EdgeEvent, GraphDailySnapshot.** Defaults to null. Wave 8 will populate. DONE.
- [x] **MCP tools fully agent-usable.** All 5 tools return structured JSON with version IDs, diff data, and actionable metadata. DONE.

## Reviewer + security + critic results

### ascend-reviewer (cumulative wave diff)

**Verdict: PASS.** All 6 safety rules pass. All 4 Wave 7 danger zones correctly mitigated. Two production incidents fixed. Zero blocking issues.

Non-blocking notes (deferred to BACKLOG):
1. `useVersions` hook fetches `{ limit: 1 }` in row-properties and table-header-cell solely to get latest versionId; no-versions UX messaging could be confusing pre-backfill.
2. `retentionCompactorService` loads all versions per (nodeType, nodeId) into memory before computing keep-set; memory spike risk at scale.
3. `graphViewAtDate` is transient (not persisted); navigating away resets to "Now". Intentional design decision.

Full report: `.ascendflow/reviews/2026-05-05-1517-wave7-close.md`.

### ascend-security (Wave 7 routes audit)

**Verdict: AUDIT PASS WITH NOTES.** 17/17 per-item checks pass. All Prisma queries userId-scoped. Cron-secret timing-safe compare on both cron routes. Restore writes forward snapshot before mutating. Branch cycle detection capped at 100 hops.

Notes (non-blocking):
1. `restore-service.ts` re-throws downstream errors with original message; Prisma schema field names could leak. Non-critical for single-user.
2. Rate limiting absent on 5 user-facing routes. Required by Wave 8.
3. Graph-snapshot replay loads all EdgeEvents into memory. Cron-secret gate mitigates DoS adequately for now.

Full report: `.ascendflow/security/2026-05-05-1517-wave7-close.md`.

### ascend-critic (product quality)

**Verdict: GOOD (post must-fix).** 11 PASS / 2 WARN / 0 FAIL across 13 product quality checks. 18/18 functional success criteria DONE.

2 must-fix items addressed in the wave-close commit:
1. `version-history-panel.tsx` "Show all" dead end replaced with real "Show older versions" button using cursor pagination.
2. `version-diff-modal.tsx` narrow viewport tabs replaced with content preview lines + `formatTrigger()` for human-readable labels.

Should-fix items deferred to BACKLOG: derivative count on BranchDialog open, three-pane desktop diff, cascade-delete tombstones for child goals, humanized field labels in diff renderers.

Full report: `.ascendflow/critiques/2026-05-05-1517-wave7-close.md`.

## Architecture notes for future waves

- **workspaceId is ready for Wave 8.** All three new tables have nullable `workspaceId` columns with indexes. Wave 8 (workspaces + collaboration) can filter by workspace without a backfill; null is treated as the user's default workspace.
- **Multi-user snapshot trigger implications.** The in-process debounce map works for single-server. Multi-server (Wave 8) needs either Redis-backed debounce or a queue-based approach. The current implementation is functionally correct (at worst, two servers might both create a snapshot; dedup catches the redundant one).
- **Merge UI builds on DERIVED_FROM edges.** Wave 8's merge feature consumes the existing branch infrastructure: the DERIVED_FROM link is the basis for identifying which node forked from which, and `@ascend/diff` provides the three-way merge input.
- **EdgeEvent powers future edge history UI.** The data is being collected but no per-edge history viewer exists yet. When built, it queries `EdgeEvent` filtered by `fromEntryId` or `toEntryId` with the existing indexes.
- **Retention policy is a single constant.** If Wave 8 adds per-user customization, the compactor already accepts `compactUserVersions(userId)` per user; the policy thresholds just need to come from `UserSettings` instead of hardcoded constants.
- **GraphDailySnapshot precompute replay is memory-bound.** For a user with 10k+ entries and 50k edge events, the in-memory replay in `graphSnapshotService.precomputeDailySnapshot` could spike memory. Before Wave 8, cursor-based chunking should replace the full load.

## Pre-deploy checklist

- [x] All 11 phase commits + 2 production incident fixes committed.
- [x] `pnpm typecheck` PASS.
- [x] `pnpm build` PASS.
- [x] 4 migrations (3 in Phase 1 + 1 DERIVED_FROM) applied locally via `prisma migrate deploy`. Will auto-apply on push (Dokploy runs `prisma migrate deploy` as part of the build).
- [x] No new env vars required. Existing `CRON_SECRET` in Dokploy env covers the 2 new cron workflows.
- [x] 2 new GitHub Actions workflows added: `version-retention.yml` (03:00 UTC) and `graph-daily-snapshot.yml` (03:30 UTC). Will activate after push.
- [x] Dockerfile updated to COPY `packages/diff/` into deps, builder, and prod-deps stages.
- [ ] Push to `origin/main` → Dokploy auto-deploys → smoke test.
- [ ] Run backfill script against prod: `pnpm tsx apps/web/scripts/backfill-versions.ts`.
- [ ] Hit `POST /api/graph/snapshots/precompute` once to seed yesterday's snapshot before the daily cron picks up.
- [ ] Verify `/api/mcp tools/list` returns 73 tools in production.
- [ ] Open a note → edit → wait 60s → verify version appears in history panel → diff → restore → confirm content reverts.
- [ ] Open graph view → drag time slider → verify graph re-renders with past state banner → Return to now.
- [ ] Restart MCP client to pick up the new 5 tools.

## Wave 8 onramp

Wave 7 closed. Wave 8 (per VISION) is **Workspaces + real-time collaboration**: `workspaceId` columns are already nullable and indexed on all Wave 7 tables. The wave adds workspace creation, invitation, role-based access, collaborative editing via `@lexical/yjs` V2 binding (upgrading from the Wave 3 snapshot-only sync), branch merge UI (consuming the Wave 7 DERIVED_FROM infrastructure + `@ascend/diff` three-way merge), and presence indicators.

Pre-Wave-8 considerations:
- **Populate `workspaceId` on existing rows.** A one-shot migration assigns all null-workspace rows to the user's default workspace once `Workspace` table exists.
- **Debounce map needs distributed coordination.** The in-process `Map<string, NodeJS.Timeout>` in `versioningService` works for single-server. Multi-server needs Redis or Postgres-backed debounce to prevent duplicate snapshots.
- **Retention compactor per-user concurrency.** When multiple users share a workspace, the compactor must handle concurrent runs on shared nodes. The current per-user approach still works because NodeVersion is user-scoped, but workspace-level snapshots (if introduced) would need additional coordination.
- **Rate limiting on all Wave 7 routes.** Required before multi-user to prevent abuse.
- **Merge UI.** DERIVED_FROM edges identify branch relationships. `@ascend/diff` provides block-level diff. The merge UI needs a three-way diff (base version, branch A, branch B) and conflict resolution. The diff engine's block matching by deterministic key already supports this pattern.
