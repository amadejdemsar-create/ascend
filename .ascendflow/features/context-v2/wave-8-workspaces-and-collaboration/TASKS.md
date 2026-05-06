# Implementation Tasks: Wave 8 — Workspaces + real-time collaboration foundation

Order matters. Each task includes the files it touches and the layer it implements. Phases that touch many existing files (Phase 3 in particular) are designed to run as a single coordinated change because partial application leaves data leak risk between users when Wave 8b adds the second user.

## Phase 1: Schema — Workspace primitives

- [ ] Update `apps/web/prisma/schema.prisma`: add `WorkspaceRole`, `MembershipStatus`, `ActivityEventType` enums.
- [ ] Update `apps/web/prisma/schema.prisma`: add `Workspace`, `WorkspaceMembership`, `ActivityEvent` models with all relations and indexes.
- [ ] Hand-write migration `apps/web/prisma/migrations/20260507000001_add_workspaces/migration.sql`. Additive only, no `search_vector` references.
- [ ] Hand-write migration `apps/web/prisma/migrations/20260507000002_seed_personal_workspaces/migration.sql`. Idempotent. For each user without a workspace: create `Workspace` (slug `personal-<random-cuid-suffix>`, name "Personal"), insert `WorkspaceMembership` (role=OWNER, status=ACTIVE).
- [ ] Add Zod schemas to `packages/core/src/schemas/workspaces.ts`: `workspaceSchema`, `createWorkspaceSchema`, `updateWorkspaceSchema`, `workspaceMembershipSchema`, `workspaceRoleEnum`, `membershipStatusEnum`, exported `Input` types.
- [ ] Add Zod schemas to `packages/core/src/schemas/activity.ts`: `activityEventSchema`, `activityEventTypeEnum`, payload discriminated union per event type, exported `Input` types.
- [ ] Add Zod schemas to `packages/core/src/schemas/permissions.ts`: `permissionActionEnum`.
- [ ] Re-export everything from `packages/core/src/index.ts`.
- [ ] Re-export from `apps/web/lib/validations.ts` for app-side imports.
- [ ] Run `npx prisma generate`, `pnpm --filter @ascend/web exec npx prisma migrate deploy`, then `npx tsc --noEmit` and `pnpm --filter @ascend/web build`. Commit only when all green.
- [ ] Delegate the migration audit to `ascend-migration-auditor` for both migrations 1 and 2. Address any findings before Phase 2.

## Phase 2: Schema — workspaceId on every existing entity, backfill, finalize

- [ ] Update `apps/web/prisma/schema.prisma`: add `workspaceId String?` (nullable for now) and `@@index([workspaceId])` to: `Goal`, `Todo`, `ContextEntry`, `Category`, `BlockDocument`, `File`, `ExtractionJob`, `ContextLink`, `ContextMap`, `Database`, `DatabaseField`, `DatabaseRow`, `DatabaseView`, `LlmUsage`, `ProgressLog`. Wave 7's three tables (`NodeVersion`, `EdgeEvent`, `GraphDailySnapshot`) already have nullable `workspaceId`; nothing to add there.
- [ ] Hand-write migration `apps/web/prisma/migrations/20260507000003_add_workspace_id_to_entities/migration.sql`. ALTER each of the 18 tables: `ADD COLUMN "workspaceId" TEXT`, `ADD CONSTRAINT FK ... REFERENCES "Workspace"("id") ON DELETE CASCADE`, `CREATE INDEX ... ON ... ("workspaceId")`. Then per-table backfill via `UPDATE ... SET "workspaceId" = (SELECT w.id FROM "Workspace" w WHERE w."ownerId" = ...)`. The 15 newly-touched tables get their backfill from `userId`; the 3 Wave 7 tables get theirs from `userId` directly (every Wave 7 row has `userId`).
- [ ] Pre-flight verification script at `apps/web/scripts/verify-workspace-id-backfill.ts`. For each of the 18 tables, count `WHERE "workspaceId" IS NULL`. Print results. Exit non-zero if any non-zero.
- [ ] Run the pre-flight on local + on a Dokploy database snapshot before Migration 4 deploys to prod.
- [ ] Hand-write migration `apps/web/prisma/migrations/20260507000004_finalize_workspace_id/migration.sql`. ALTER each of the 18 tables: `ALTER COLUMN "workspaceId" SET NOT NULL`. The migration aborts with a clear error if any column violates the constraint at apply time.
- [ ] Update `apps/web/prisma/schema.prisma`: change `workspaceId String?` to `workspaceId String` (NOT NULL) on all 18 tables. Add the `workspace` relation field per table.
- [ ] Run `npx prisma generate`, `prisma migrate deploy` locally, full verification. Commit when green.
- [ ] Delegate to `ascend-migration-auditor` for migrations 3 and 4. Migration 4 specifically requires the auditor to confirm the pre-flight gate prevents data loss.

## Phase 3: Permission service, workspace context, service updates (THE HEAVY ONE)

- [ ] Create `apps/web/lib/services/workspace-service.ts`: `create(userId, input)`, `getBySlug(slug)`, `getById(workspaceId)`, `listForUser(userId)`, `update(userId, workspaceId, input)`, `getUserDefaultWorkspaceId(userId)`. Every method userId-scoped via `WorkspaceMembership` join.
- [ ] Create `apps/web/lib/services/workspace-membership-service.ts`: `addMember(workspaceId, userId, role)`, `getRole(workspaceId, userId)`, `listMembers(workspaceId)`, `updateRole`, `remove`.
- [ ] Create `apps/web/lib/services/permission-service.ts`: `canPerform(userId, workspaceId, action: PermissionAction): Promise<boolean>`. Cache membership lookups per request via a `Map` passed through `AsyncLocalStorage` if needed. For Wave 8, role hierarchy: OWNER allows everything; ADMIN allows everything except MANAGE_WORKSPACE; EDITOR allows READ_NODE/WRITE_NODE/DELETE_NODE; VIEWER allows READ_NODE only. (Only OWNER ever exercised in Wave 8; the table exists for Wave 8b.)
- [ ] Create `apps/web/lib/services/workspace-context-service.ts`: `resolveDefaultWorkspaceId(userId)`, `generateCrdtToken(userId, workspaceId, entryId, ttlSeconds = 300)`. Token signed with `CRDT_JWT_SECRET` (separate env from main JWT secret).
- [ ] Modify `apps/web/lib/services/auth-service.ts`: extend `signAccessToken` and `signRefreshToken` to include `currentWorkspaceId` claim. Refresh path resolves the user's default workspace if claim is missing (forward-compat for tokens issued before Wave 8 deployed).
- [ ] Modify `apps/web/lib/auth.ts`: `authenticate()` now returns `{ userId, workspaceId }`. Three auth paths (cookie JWT, Bearer JWT, Bearer API key) all resolve the workspaceId. API key path: look up `User.defaultWorkspaceId` (add this column? OR resolve via `WorkspaceMembership` join). Recommend: add `User.defaultWorkspaceId String?` column (nullable initially, then NOT NULL after backfill); avoids a JOIN on every request.
- [ ] Sub-task in Phase 1 schema work (retroactive add): include `User.defaultWorkspaceId` nullable; backfill in migration 2 (set to the personal workspace id).
- [ ] Modify EVERY existing service to take `(userId, workspaceId, ...)` and add `workspaceId` to every `where` clause. Mutations call `permissionService.canPerform` first. Files affected:
  - `apps/web/lib/services/goal-service.ts`
  - `apps/web/lib/services/todo-service.ts`
  - `apps/web/lib/services/context-service.ts`
  - `apps/web/lib/services/category-service.ts`
  - `apps/web/lib/services/dashboard-service.ts`
  - `apps/web/lib/services/recurring-service.ts`
  - `apps/web/lib/services/todo-recurring-service.ts`
  - `apps/web/lib/services/export-service.ts`
  - `apps/web/lib/services/import-service.ts`
  - `apps/web/lib/services/file-service.ts`
  - `apps/web/lib/services/extraction-queue-service.ts`
  - `apps/web/lib/services/llm-service.ts`
  - `apps/web/lib/services/embedding-service.ts`
  - `apps/web/lib/services/context-map-service.ts`
  - `apps/web/lib/services/block-document-service.ts`
  - `apps/web/lib/services/block-migration-service.ts`
  - `apps/web/lib/services/database-service.ts`
  - `apps/web/lib/services/database-field-service.ts`
  - `apps/web/lib/services/database-row-service.ts`
  - `apps/web/lib/services/database-view-service.ts`
  - `apps/web/lib/services/database-relation-service.ts`
  - `apps/web/lib/services/database-query-service.ts`
  - `apps/web/lib/services/context-link-service.ts`
  - `apps/web/lib/services/versioning-service.ts` (records `workspaceId` on `NodeVersion`)
  - `apps/web/lib/services/edge-event-service.ts` (records `workspaceId` on `EdgeEvent`)
  - `apps/web/lib/services/diff-service.ts`
  - `apps/web/lib/services/restore-service.ts`
  - `apps/web/lib/services/branch-service.ts`
  - `apps/web/lib/services/graph-history-service.ts`
  - `apps/web/lib/services/graph-snapshot-service.ts` (records `workspaceId` on `GraphDailySnapshot`)
  - `apps/web/lib/services/retention-compactor-service.ts`
  - `apps/web/lib/services/version-backfill-service.ts`
  - `apps/web/lib/services/gamification-service.ts` (XP/streaks remain per-user; no workspaceId — keep userId-only signature)
  - `apps/web/lib/services/user-service.ts` (per-user; no workspaceId)
- [ ] Modify EVERY existing API route to read `{ userId, workspaceId }` from `authenticate()` and pass both to the service:
  - All routes under `apps/web/app/api/goals/`, `todos/`, `context/`, `categories/`, `dashboard/`, `recurring/`, `files/`, `databases/`, `versions/`, `graph/`, `mcp/`. Mass refactor; one PR per route group recommended for review tractability, OR one big PR if `ascend-reviewer` can handle it.
- [ ] Update `apps/web/lib/api-client.ts`: no signature changes (workspaceId is server-resolved). Add an interceptor that surfaces 403 (workspace permission denied) distinctly from 401 (unauthenticated), via a new `ascend:workspace-permission-denied` event.
- [ ] Update `apps/web/lib/queries/keys.ts`: every existing key factory takes a workspaceId discriminator. Where the client doesn't know workspaceId yet, use the persisted `useUIStore.currentWorkspaceId` value. Initial load: resolve from the `me` endpoint.
- [ ] Update `apps/web/lib/stores/ui-store.ts`: add `currentWorkspaceId: string | null`, persist via `@ascend/storage`. Set on login, cleared on logout. Defaults to null until first `me` response.
- [ ] Run full test+build cycle. `npx tsc --noEmit`, `pnpm --filter @ascend/web build`, manual smoke that all existing features still work for the single user.
- [ ] Delegate to `ascend-reviewer` for safety rule + pattern compliance audit on the modified service layer (Safety Rule 1 explicitly extended to workspaceId).
- [ ] Delegate to `ascend-security` for cross-tenant data leak audit. Test scaffold: spin up a second test user in local, attempt cross-workspace reads via API key, expect 403/404 on every endpoint.

## Phase 4: Hocuspocus server — `apps/crdt/`

- [ ] Scaffold `apps/crdt/` package: `package.json` (name `@ascend/crdt`), `tsconfig.json` (extends repo base), `Dockerfile` (multi-stage Node 20 build), `.env.example` listing required env vars.
- [ ] Add to root `pnpm-workspace.yaml` if not pattern-matched.
- [ ] Install: `@hocuspocus/server`, `@hocuspocus/extension-database`, `@hocuspocus/extension-logger`, `yjs`, `jose` (for JWT verification).
- [ ] Create `apps/crdt/src/server.ts`: bootstrap Hocuspocus on `process.env.PORT`. Mount `Database` extension that reads `BlockDocument.state` for initial state and writes via HTTP POST to `CRDT_PERSIST_URL` with `x-crdt-secret`.
- [ ] Create `apps/crdt/src/auth.ts`: `onAuthenticate({ token, documentName, ... })` verifies the JWT against `CRDT_JWT_SECRET`, checks `aud === "crdt"`, checks `documentName === "blockdoc:" + payload.entryId`, returns `{ user: { userId, workspaceId, entryId, permissions } }` on success or throws `403` on failure.
- [ ] Create `apps/crdt/src/persist.ts`: HTTP client for the persist endpoint. Retries with exponential backoff on 5xx; logs failures clearly; never blocks the connection.
- [ ] Create `apps/crdt/src/health.ts`: HTTP `/healthz` endpoint returning `{ ok: true, connections, uptime }`.
- [ ] Create `apps/crdt/Dockerfile` mirroring web app's pattern (deps stage, builder, prod). Image runs `node dist/server.js`.
- [ ] Create web app endpoint `apps/web/app/api/crdt/token/route.ts`: POST body `{ entryId }`. Authenticates via main JWT path; verifies the user can write the BlockDocument for that entry; calls `workspaceContextService.generateCrdtToken`; returns `{ token, wsUrl, documentName, expiresAt }`.
- [ ] Create web app endpoint `apps/web/app/api/blockdocs/[entryId]/persist/route.ts`: header-secret-only auth (`x-crdt-secret`). Body validation. Persists via `block-document-service.persistSnapshot` and triggers `versioningService.scheduleSnapshot(EDIT_DEBOUNCED)`.
- [ ] Add Dokploy-personal application via the `dokploy-personal` MCP: `applicationCreate` with name `ascend-crdt`, GitHub provider, branch main, build path `apps/crdt`. Add domain `crdt.ascend.nativeai.agency`. Set env vars (`DATABASE_URL`, `CRDT_JWT_SECRET`, `CRDT_PERSIST_URL`, `CRDT_PERSIST_SECRET`).
- [ ] Add web app env vars in Dokploy + `.env.local`: `CRDT_JWT_SECRET`, `CRDT_WS_URL=wss://crdt.ascend.nativeai.agency`, `CRDT_PERSIST_SECRET`.
- [ ] Generate fresh secrets: `openssl rand -hex 32` for both `CRDT_JWT_SECRET` and `CRDT_PERSIST_SECRET`. Set in Dokploy UI for both apps. Record in BACKLOG/CLAUDE.md the secret rotation plan.
- [ ] Smoke: deploy both apps. Curl `/healthz`. Issue a token via web app. Connect via `wscat` or a minimal Hocuspocus client test. Verify presence of state via the persist endpoint.
- [ ] Delegate to `ascend-security` for the auth flow audit (Phase 4 must pass before Phase 5 starts).
- [ ] Delegate to `ascend-architect` for the cross-platform boundary review on `apps/crdt/`. Confirm no `apps/web/*` imports in the CRDT app.

## Phase 5: Lexical CRDT upgrade

- [ ] Web search to verify `@lexical/yjs` v2 binding's release status in this session before locking version. Confirm against npm/lexical release notes.
- [ ] Install in web app: `@lexical/yjs`, `y-websocket` or `@hocuspocus/provider`, `y-indexeddb` for client-side recovery snapshots.
- [ ] Create `apps/web/lib/realtime/use-realtime-document.ts`: React hook. Inputs: `entryId`. Outputs: `{ ydoc, provider, presence, isConnected, error }`. Lifecycle: fetch CRDT token on mount → connect Hocuspocus provider → manage Y-doc per entry. Cleanup on unmount or entry change.
- [ ] Create `apps/web/components/editor/collaboration-plugin.tsx`: Lexical plugin wrapping `@lexical/yjs`'s `CollaborationPlugin` with our connection lifecycle.
- [ ] Modify `apps/web/components/context/context-block-editor.tsx`: replace the existing `AutosavePlugin` with `<CollaborationPlugin entryId={...} />`. Keep the legacy autosave path as a graceful-degradation fallback when the realtime connection fails (toast: "Real-time disabled, falling back to autosave").
- [ ] Modify `apps/web/lib/services/block-document-service.ts`: ensure the `persistSnapshot` path remains compatible with both legacy POST and new internal CRDT persist. Both write the same `BlockDocument` columns.
- [ ] Update DZ-10 (Yjs state size cap) handling — ensure the persist endpoint enforces the 1 MiB cap on state writes; reject + log if exceeded (rare in practice but the cap is the budget guard).
- [ ] Manual smoke: open a note in two browser tabs, edit in tab A, see edit in tab B within ~250ms. Network throttle to 4G profile, repeat. Disconnect Wi-Fi for 30s, verify recovery via `y-indexeddb` + Yjs CRDT merge.
- [ ] `ax:verify-ui` scenarios: realtime sync, presence avatars, collaborative cursors, fallback to legacy autosave, recovery after disconnect.

## Phase 6: Presence + collaborative cursors

- [ ] Create `apps/web/components/realtime/presence-avatars.tsx`: avatar stack rendered in the editor toolbar. Reads `provider.awareness` states. Each state = one connected client with `{ userId, displayName, color, cursorPosition }`.
- [ ] Create `apps/web/components/realtime/collaborative-cursor.tsx`: Lexical decorator that renders remote cursors + selections. Uses Yjs awareness protocol.
- [ ] Mount both in `apps/web/components/context/context-block-editor.tsx`.
- [ ] Color assignment: deterministic per userId (hash to HSL), stored in awareness state on connect.
- [ ] Reduced-motion: disable cursor animations when `prefers-reduced-motion`.
- [ ] Accessibility: presence avatars include `aria-label` with displayName + "is editing"; cursors are `aria-hidden` (visual only, the editing state is announced via toast on connect).
- [ ] Manual smoke: open in two tabs as the same user → see two presence sessions, each with its own cursor color.

## Phase 7: Activity feed

- [ ] Create `apps/web/lib/services/activity-event-service.ts`: `log(workspaceId, userId, eventType, payload)`, `list(workspaceId, opts)`, cursor-paginated.
- [ ] Hook activity logging into existing services (write a small helper to wire each):
  - `contextService.create/delete` → NODE_CREATED/NODE_DELETED.
  - `goalService.create/delete` → NODE_CREATED/NODE_DELETED.
  - `todoService.create/delete` → NODE_CREATED/NODE_DELETED (only on hard delete; soft completes do not log).
  - `databaseRowService.create/delete` → NODE_CREATED/NODE_DELETED.
  - `databaseService.create/delete` → NODE_CREATED/NODE_DELETED for the DATABASE entry.
  - `contextLinkService.create/remove` → LINK_CREATED/LINK_REMOVED.
  - `restoreService.restore` → NODE_RESTORED.
  - `branchService.branch` → NODE_BRANCHED.
  - `workspaceMembershipService.addMember/remove/updateRole` → MEMBER_*.
- [ ] Capture entity title in `payload` at delete time so the feed can render gracefully after deletion.
- [ ] Create API route `apps/web/app/api/workspaces/[id]/activity/route.ts`: GET, paginated, query params `eventType?`, `since?`, `cursor?`, `limit?`.
- [ ] Create React Query hooks at `apps/web/lib/hooks/use-activity.ts`: `useActivityFeed(workspaceId, filters)`.
- [ ] Add query keys to `apps/web/lib/queries/keys.ts`: `activity.feed(workspaceId, filters)`.
- [ ] Create `apps/web/components/activity/activity-event-row.tsx`: renders `<Avatar /><Verb /><Subject /><Timestamp />` with type-specific verb formatting via a switch.
- [ ] Create `apps/web/components/activity/activity-filters.tsx`: event type checkboxes, date range, actor dropdown.
- [ ] Create `apps/web/components/activity/activity-feed-view.tsx`: page-level component composing the row list + filters + load more.
- [ ] Create page `apps/web/app/(app)/activity/page.tsx`.
- [ ] Add "Activity" entry to `apps/web/components/layout/nav-config.ts`.
- [ ] Wire cross-domain invalidation: every mutation that fires an activity event also invalidates `queryKeys.activity.feed(workspaceId, *)`.
- [ ] `ax:verify-ui` scenario: create a note → navigate `/activity` → see NODE_CREATED → click → navigates to the note.

## Phase 8: Workspace switcher + settings page

- [ ] Create `apps/web/lib/hooks/use-workspaces.ts`: `useWorkspaces`, `useWorkspace`, `useUpdateWorkspace`, `useWorkspaceMembers`.
- [ ] Add query keys to `apps/web/lib/queries/keys.ts`: `workspaces.all()`, `workspaces.list()`, `workspaces.detail(id)`, `workspaces.members(id)`.
- [ ] Create API routes:
  - `apps/web/app/api/workspaces/route.ts` (GET list, POST disabled-but-implemented)
  - `apps/web/app/api/workspaces/[id]/route.ts` (GET, PATCH, DELETE-403)
  - `apps/web/app/api/workspaces/[id]/members/route.ts` (GET)
- [ ] Create `apps/web/components/workspace/workspace-switcher.tsx`: dropdown in sidebar header. Shows current workspace name + chevron. Dropdown lists user's workspaces (one) + "Workspace settings" link. Clicking the workspace entry is a no-op with `aria-disabled="true"` and a tooltip.
- [ ] Create `apps/web/components/workspace/member-list.tsx`: simple table for the settings page.
- [ ] Create `apps/web/components/workspace/workspace-settings-page.tsx`: combines name editing + member list + disabled invite button + disabled delete button. Uses `Card` primitives from shadcn.
- [ ] Modify `apps/web/components/layout/app-sidebar.tsx`: mount `WorkspaceSwitcher` in the header above nav links.
- [ ] Create page `apps/web/app/(app)/settings/workspace/page.tsx`.
- [ ] Add "Workspace" entry under settings in nav (or a tab on the existing `/settings` page if there is one — read the current settings page first).
- [ ] `ax:verify-ui` scenario: open switcher, see workspace listed, click "Workspace settings", edit name, save, verify sidebar header updates.

## Phase 9: MCP — implicit workspace context + 3 new tools

- [ ] Modify `apps/web/lib/mcp/server.ts`: factory `createAscendMcpServer(userId, workspaceId)` (was `(userId)`). Workspace resolved via `workspaceContextService.resolveDefaultWorkspaceId(userId)` at MCP API key auth time.
- [ ] Update `apps/web/app/api/mcp/route.ts`: resolve workspaceId from API key auth, pass to factory.
- [ ] Update every existing MCP handler file to take and pass `workspaceId` to the underlying service:
  - `apps/web/lib/mcp/tools/goal-tools.ts`
  - `apps/web/lib/mcp/tools/progress-tools.ts`
  - `apps/web/lib/mcp/tools/bulk-tools.ts`
  - `apps/web/lib/mcp/tools/dashboard-tools.ts`
  - `apps/web/lib/mcp/tools/category-tools.ts`
  - `apps/web/lib/mcp/tools/data-tools.ts`
  - `apps/web/lib/mcp/tools/context-tools.ts`
  - `apps/web/lib/mcp/tools/todo-tools.ts`
  - `apps/web/lib/mcp/tools/context-graph-tools.ts`
  - `apps/web/lib/mcp/tools/focus-tools.ts`
  - `apps/web/lib/mcp/tools/llm-tools.ts`
  - `apps/web/lib/mcp/tools/block-tools.ts`
  - `apps/web/lib/mcp/tools/file-tools.ts`
  - `apps/web/lib/mcp/tools/database-tools.ts`
  - `apps/web/lib/mcp/tools/version-tools.ts`
- [ ] Create `apps/web/lib/mcp/tools/workspace-tools.ts` with handlers for the 3 new tools.
- [ ] Add JSON Schemas to `apps/web/lib/mcp/schemas.ts` for `list_workspaces`, `get_workspace`, `get_activity_events`. Update tool count comment from 73 to 76.
- [ ] Add `WORKSPACE_TOOL_NAMES` Set + routing branch in `apps/web/lib/mcp/server.ts`.
- [ ] Update CLAUDE.md MCP section to "76 tools across handler files (... + 3 Wave 8 workspace tools: list_workspaces, get_workspace, get_activity_events = 76)". Same line in `apps/web/lib/mcp/server.ts` overview comment.
- [ ] Update `apps/web/.claude/rules/mcp-tool-patterns.md` with the new tool count and add `WORKSPACE_TOOL_NAMES` row.
- [ ] Manual smoke via MCP client: `tools/list` returns 76 tools. `list_workspaces()` returns one entry. `get_activity_events()` returns paginated feed.

## Phase 10: Verification, audits, wave close

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `pnpm --filter @ascend/web build`. Must pass.
- [ ] Run `pnpm --filter @ascend/crdt build`. Must pass.
- [ ] Run `pnpm --filter @ascend/web lint`. Address all errors and warnings.
- [ ] Run `ax:cross-platform-check` to verify no banned imports leaked into `packages/*`.
- [ ] Run `ax:review` skill — `ascend-reviewer` audits Wave 8 patches for safety rule + pattern compliance. Must return PASS.
- [ ] Run `ax:verify-ui` covering: realtime sync, presence, cursors, workspace settings, switcher, activity feed, every existing surface (regression check). Must return PASS or PASS WITH NOTES with zero blocking scenarios.
- [ ] Run `ax:critique` — `ascend-critic` evaluates product quality. Must return GOOD or WORLD-CLASS. NEEDS WORK or NOT READY blocks close.
- [ ] Re-run `ascend-security` audit on the cumulative cross-tenant data leak surface. Multi-user scaffold test.
- [ ] Re-run `ascend-migration-auditor` audit on the cumulative four migrations.
- [ ] Manually run the success test from PRD.md (15 steps).
- [ ] Update `apps/web/CLAUDE.md`: add Wave 8 architecture section (Workspaces + RBAC plumbing + Activity events + Real-time CRDT + Hocuspocus app), DZ-21 through DZ-24, MCP tool count update, Entity Model rows for Workspace + WorkspaceMembership + ActivityEvent, Views table row for Activity feed + Workspace settings, File Lookup rows for new services and components.
- [ ] Update `apps/web/.claude/rules/service-patterns.md`: extend Safety Rule 1 to include workspaceId. Update example to show the `(userId, workspaceId, ...)` signature.
- [ ] Update `apps/web/.claude/rules/api-route-patterns.md`: update the standard route structure to show `{ userId, workspaceId } = await authenticate(request)`.
- [ ] Update `.ascendflow/BACKLOG.md` with Wave 8b items: invitations, multi-member, per-node permissions, comments, mentions, publishing, branching merge UI, billing, workspace deletion, workspace creation by users, audit log retention.
- [ ] Run `ax:wave-close 8`. Generates `CLOSE-OUT.md`.
- [ ] Run `ax:deploy-check`. Must pass.
- [ ] Push all commits to `origin/main`. Verify Dokploy auto-deploy of both `ascend` (web) and `ascend-crdt`. Confirm prod healthy.
- [ ] Final smoke on prod: real two-tab edit on `https://ascend.nativeai.agency`, MCP tool count 76, activity feed accessible, workspace settings reachable.
