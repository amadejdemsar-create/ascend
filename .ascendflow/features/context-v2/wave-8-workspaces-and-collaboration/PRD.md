# Wave 8: Workspaces + real-time collaboration foundation

**Slug:** `context-v2` / `wave-8-workspaces-and-collaboration`
**Created:** 6. 5. 2026
**Status:** in-progress
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md) (W8 section)
**Wave sizing:** ~4 weeks. Larger than any wave to date. The 6. 5. saves explicitly recommended a fresh session for Wave 8 because of the heterogeneous scope and multi-user implications across every existing service. Planned in this session at the user's direction, with execution intended for fresh sessions per phase.

## Problem

Ascend is a single-user OS. Every entity is scoped by `userId`, autosave is snapshot-only (Wave 3 deferred true CRDT to Wave 8), edits race across tabs because there is no shared document state, and the schema has no concept of a shared container. Wave 7 prepared `workspaceId` nullable columns on `NodeVersion`, `EdgeEvent`, and `GraphDailySnapshot` precisely so Wave 8 could populate without a backfill on those three. The remaining ~20 entity tables still have no workspace concept.

Two problems block growth into a real multi-user product:

1. **No multi-tenant primitive.** The codebase is single-tenant by construction. Adding a second user later means refactoring every service, every route, every MCP tool. The longer this is deferred, the more code accumulates that has to be migrated.
2. **No real-time concurrency.** The Wave 3 BlockDocument autosave persists a full Lexical snapshot every 1.5 seconds and overwrites whatever was there. Open the same note in two tabs, edit both, lose work. This problem is felt today as a single user (multi-tab, multi-device); it becomes catastrophic as soon as a second person edits anything.

Wave 8 ships the architectural foundation and the real-time editing experience. It does NOT ship inviting other users, permission overrides, comments, mentions, publishing, or billing. Those land in Wave 8b as a separate planning cycle.

## User Story

As a user, I want to edit the same note in multiple tabs, on my laptop and my phone, and have every keystroke sync without overwrites, because I lose work today every time I context-switch between devices. As a future product, I want every entity to live in a workspace with role-based access control, so when I invite collaborators (Wave 8b), the system already knows what each member can see. As a power user, I want a workspace activity feed showing every meaningful change, so I can review what happened yesterday without scrubbing per-node version history one entity at a time. As an AI agent connected via MCP, I want to query workspace metadata and activity, so I can answer questions like "what did the user create this week" without reading every entity.

## Success Criteria

### Functional

- [ ] **`Workspace` table** — first-class entity. Fields: `id`, `slug` (unique, kebab-case, used in future public URLs), `name`, `ownerId`, `createdAt`, `updatedAt`. Every user has exactly one personal workspace, created in the backfill, named after the user.
- [ ] **`WorkspaceMembership` table** — join table between `User` and `Workspace`. Fields: `id`, `workspaceId`, `userId`, `role` (enum `OWNER` / `ADMIN` / `EDITOR` / `VIEWER`), `status` (enum `PENDING` / `ACTIVE` / `REMOVED`), `invitedAt?`, `acceptedAt?`, `removedAt?`. Wave 8 only ever creates `OWNER` + `ACTIVE` rows. The other role and status values exist in the schema for Wave 8b but are not exercised.
- [ ] **`ActivityEvent` table** — workspace-level event log distinct from `NodeVersion` (entity history) and `EdgeEvent` (edge history). Fields: `id`, `workspaceId`, `userId` (actor), `eventType` (enum `WORKSPACE_CREATED` / `MEMBER_ADDED` / `MEMBER_REMOVED` / `MEMBER_ROLE_CHANGED` / `NODE_CREATED` / `NODE_DELETED` / `NODE_RESTORED` / `NODE_BRANCHED` / `LINK_CREATED` / `LINK_REMOVED`), `payload` (JSONB with event-specific fields), `createdAt`. NodeVersion + EdgeEvent already cover most "what changed" needs; ActivityEvent surfaces the cross-cutting subset worth displaying in a feed.
- [ ] **`workspaceId` column added to every existing tenant-scoped table** and backfilled to the user's personal workspace. Tables touched: `Goal`, `Todo`, `ContextEntry`, `Category`, `BlockDocument`, `File`, `ExtractionJob`, `ContextLink`, `ContextMap`, `Database`, `DatabaseField`, `DatabaseRow`, `DatabaseView`, `LlmUsage`, `ProgressLog`. Wave 7 already added nullable `workspaceId` to `NodeVersion`, `EdgeEvent`, `GraphDailySnapshot`; Wave 8 populates them. After backfill, `workspaceId` is `NOT NULL` on every entity. `User`, `UserStats`, `XpEvent`, `Session` remain user-scoped (no workspaceId).
- [ ] **Default workspace resolution from JWT.** The auth service issues a JWT that includes `userId` AND `currentWorkspaceId`. `validateApiKey` / `authenticate` returns both. Every existing service signature `(userId, ...)` gets a sibling `(userId, workspaceId, ...)` overload; the workspaceId comes from the auth context. MCP API key path resolves to the user's personal workspace.
- [ ] **`permissionService`** — single source of truth: `canPerform(userId, workspaceId, action: PermissionAction): Promise<boolean>`. Permission actions: `READ_NODE` / `WRITE_NODE` / `DELETE_NODE` / `MANAGE_MEMBERS` / `MANAGE_WORKSPACE`. The skeleton checks only "is the user a member of the workspace with sufficient role". Wave 8b extends with per-node permission overrides. Every existing service method calls `permissionService.canPerform` before mutating; reads check at the route layer.
- [ ] **Hocuspocus server (separate Dokploy service).** New `apps/crdt/` package in the monorepo containing the Hocuspocus server. Built as its own Docker image. Deployed to `dokploy-personal` as a separate application. Domain: `crdt.ascend.nativeai.agency`. Authenticates via short-lived JWT issued by the web app's `/api/crdt/token` endpoint. Persists Yjs document state to the existing `BlockDocument.state` column via a Hocuspocus extension that calls back into the web app's API.
- [ ] **Lexical CRDT upgrade** — replace the Wave 3 snapshot-only autosave with `@lexical/yjs` v2 binding. The block editor connects to Hocuspocus over WebSocket per opened entry. Yjs binary deltas flow through Hocuspocus to all connected clients on the same document. The legacy `/api/context/[id]/blocks/sync` route remains for fallback (degraded mode when Hocuspocus is unreachable) but the primary autosave path is now the WebSocket.
- [ ] **Presence + collaborative cursors.** Yjs awareness protocol surfaces `{ userId, displayName, color, cursorPosition, selection }` to all connected clients. UI: presence avatars in the editor toolbar (top-right of editor area); collaborative cursor decorations rendered in the Lexical editor body. With one user (today), the user sees only themselves; the surface is correct for the day a second user joins.
- [ ] **Workspace switcher UI** — minimal. Sidebar header gets a workspace name + dropdown chevron. Dropdown shows the user's workspace list (one entry today: the personal workspace). Clicking the entry is a no-op for now; future Wave 8b extends this when multiple workspaces exist per user.
- [ ] **Workspace settings page** at `/settings/workspace`. Shows: workspace name + slug (editable by OWNER), member list (one row today: the owner), "Invite member" button (disabled with tooltip "Invitations land in Wave 8b"), and a danger-zone "Delete workspace" button (disabled because deleting the only workspace would orphan all data; re-enabled in Wave 8b once a user can have more than one).
- [ ] **Activity feed UI** at `/activity`. Reverse-chronological list of `ActivityEvent` rows for the current workspace. Filters: actor (today only the user), event type, date range. Items render as `<actor> <verb> <subject> · <timestamp>`. Click an item to navigate to the affected entity (where applicable). Cursor-paginated, last 50 events, "Load more" button.
- [ ] **3 new MCP tools** (`list_workspaces`, `get_workspace`, `get_activity_events`). Tool count: **73 → 76**. All Zod-validated, userId from server factory, workspaceId resolution + permission check before any read.
- [ ] **Existing 73 MCP tools accept implicit workspace context.** No tool signature changes (workspaceId comes from the API key's resolved context). Every handler updated to pass workspaceId to the underlying service. Tools that operate across workspaces (e.g., a future `move_to_workspace`) are deferred.
- [ ] **No data loss during backfill.** The wave's risk surface is the workspaceId backfill on 15 existing tables, several of which have hundreds to thousands of rows in prod (635 NodeVersions today, growing). Migrations are hand-written, idempotent, and verified on a Dokploy database snapshot before running on prod.

### Quality

- [ ] **CRDT message latency** — under 100ms median round trip from keystroke to other-tab render at LAN distance, under 250ms over typical broadband. Measured via Hocuspocus's built-in metrics + a manual two-tab smoke test.
- [ ] **CRDT reconnect** — disconnecting and reconnecting a tab does not lose the in-tab buffered edits. Hocuspocus's offline buffer + Yjs's CRDT merge guarantee convergence.
- [ ] **Permission check overhead** — `permissionService.canPerform` returns within 5ms for cached membership lookups. Membership cached per request via a request-scoped map (no Redis required for a single-user system; revisit when Wave 8b adds per-node overrides).
- [ ] **Backfill idempotency** — re-running the backfill script reports `created: 0` across the board after the first successful run. Verified by running it twice on local before deploying.
- [ ] **`tsc --noEmit` and `pnpm build` pass with zero errors at every commit.**
- [ ] **`ascend-security` audit PASS** on permission service + every updated service method + Hocuspocus auth flow. Specific checks: workspaceId scoping on every Prisma query (extending Safety Rule 1), JWT verification on every Hocuspocus connection, no userId or workspaceId from request bodies (server-resolved only).
- [ ] **`ascend-migration-auditor` PASS** on every migration. The Wave 8 migrations are additive (new tables + new columns) until the final step where `workspaceId` flips to `NOT NULL`. The flip is gated on a verified post-backfill row count check; the migration refuses to apply if any row in any tenant table has `workspaceId IS NULL`.
- [ ] **`ascend-architect` PASS** on the `apps/crdt/` boundary. The Hocuspocus server runs in Node and is allowed to import `ws`, `@hocuspocus/server`, `@hocuspocus/extension-database`, `yjs`. It does NOT import from `apps/web/*` directly; instead it talks to the web app via HTTP for persistence and auth. Shared logic (Yjs encoding helpers, document keys) goes into `packages/crdt-shared/` if needed.
- [ ] **`ascend-critic` verdict at GOOD or WORLD-CLASS at wave close.**
- [ ] **`ax:verify-ui` PASS** on: open a note in two browser windows → edit in window A → see the edit appear in window B within 250ms; presence avatar shows the user; refresh window A → state survives; navigate to `/settings/workspace` → see workspace name + member list with one entry; navigate to `/activity` → see at least one event; switch the workspace dropdown (no-op today, must not crash).

### Cross-platform readiness

- [ ] **Workspace + membership Zod schemas in `@ascend/core`** (`packages/core/src/schemas/workspaces.ts`). Mobile (Wave 6) reuses validators.
- [ ] **`@ascend/crdt-shared` (new package, optional)** — pure-TS Yjs document key conventions and any encoding helpers needed by both `apps/web` and `apps/crdt` and future `apps/mobile`. Skip if no shared logic emerges; preferable to a forced abstraction.
- [ ] **Activity event types in `@ascend/core`** — enum + payload Zod discriminated union. Mobile + desktop consume identically.
- [ ] **Permission action enum in `@ascend/core`** so MCP clients and future native apps can speak the same language.
- [ ] **Hocuspocus client connection helper** lives in `apps/web/lib/realtime/`, imports from `@ascend/crdt-shared` if used. Mobile will write its own equivalent in Wave 6 using the React Native Yjs bindings.

## Affected Layers

- **Prisma schema** (full diff in [Data Model Changes](#data-model-changes)):
  - `Workspace` table (NEW)
  - `WorkspaceMembership` table (NEW)
  - `ActivityEvent` table (NEW)
  - `WorkspaceRole` enum (NEW): `OWNER` / `ADMIN` / `EDITOR` / `VIEWER`
  - `MembershipStatus` enum (NEW): `PENDING` / `ACTIVE` / `REMOVED`
  - `ActivityEventType` enum (NEW): 10 values listed above
  - `workspaceId` column added to 15 existing tables, NOT NULL after backfill
  - Wave 7's `workspaceId String?` columns on `NodeVersion`, `EdgeEvent`, `GraphDailySnapshot` are populated and flipped to `NOT NULL`

- **Packages (`packages/*`):**
  - **`@ascend/core` (`packages/core/src/schemas/workspaces.ts` NEW, `packages/core/src/schemas/activity.ts` NEW, `packages/core/src/schemas/permissions.ts` NEW)** — workspace, membership, activity event Zod schemas + permission action enum.
  - **`@ascend/crdt-shared` (`packages/crdt-shared/` NEW, optional)** — pure-TS Yjs document-key helpers shared between web and crdt server and future mobile.

- **Apps (`apps/*`):**
  - **`apps/crdt/` (NEW app)** — standalone Hocuspocus server. Its own `package.json`, `Dockerfile`, deployment to dokploy-personal. Listens on port from env. Uses `@hocuspocus/server` + `@hocuspocus/extension-database` (custom Postgres-backed via the web app's HTTP API for persistence, OR direct Prisma client). JWT auth via `onAuthenticate` hook. Y-doc per `BlockDocument` keyed by `entryId`.

- **Service layer (`apps/web/lib/services/`):**
  - **`workspaceService.ts` (NEW)** — `create`, `getBySlug`, `getById`, `listForUser`, `update`, owner-only `delete` (no-op in Wave 8). Resolves the user's default personal workspace via `WorkspaceMembership` join.
  - **`workspaceMembershipService.ts` (NEW)** — `addMember(workspaceId, userId, role)` (Wave 8 only used during backfill to seed OWNER), `getRole(workspaceId, userId)`, `listMembers(workspaceId)`, `updateRole`, `remove`.
  - **`activityEventService.ts` (NEW)** — `log(workspaceId, userId, eventType, payload)`, `list(workspaceId, opts)`, with cursor pagination. Hooked into existing services (context create/delete, todo create/delete, goal create/delete, link create/remove, version restore, branch).
  - **`permissionService.ts` (NEW)** — single source: `canPerform(userId, workspaceId, action): Promise<boolean>`. Implements the role hierarchy. Wave 8b extends with per-node overrides via a node-permission table (deferred).
  - **`workspaceContextService.ts` (NEW)** — resolves `currentWorkspaceId` from JWT or API key. Issues short-lived JWTs for Hocuspocus connections (`generateCrdtToken(userId, workspaceId, entryId)`) signed with a separate CRDT_JWT_SECRET, expires in 5 minutes, scoped to a single document.
  - **`authService.ts`** — modified: token payload extended with `currentWorkspaceId`. Refresh flow re-resolves the workspace in case it changed (Wave 8 has no flow that changes it; Wave 8b has workspace switching).
  - **`fileService.ts`** — `presignUpload`, `confirmUpload`, `uploadBytes` accept and persist `workspaceId`. R2 keys remain unchanged (`<userId>/<fileId>` — workspaceId not in path) because R2 keys are user-scoped storage paths, not tenancy boundaries.
  - **All existing services that mutate user-owned entities** (goal, todo, context, category, blockDocument, file, contextLink, contextMap, database, databaseField, databaseRow, databaseView, llmUsage, recurring, todoRecurring, dashboard, embedding, llm, contextMap) — every method gets a `workspaceId` parameter (resolved from auth context at the route layer), every Prisma query gets a `workspaceId` filter alongside the existing `userId` filter, every mutation calls `permissionService.canPerform` before writing.
  - **Snapshot triggers (Wave 7)** — `versioningService.scheduleSnapshot` already scoped by userId; extended to record `workspaceId` on the new `NodeVersion` row. `edgeEventService.logCreated/Removed/Updated` extended similarly.
  - **`activity-event-service.ts` hooks** wired into: `contextService.create/delete`, `todoService.create/delete`, `goalService.create/delete`, `contextLinkService.create/remove`, `restoreService.restore`, `branchService.branch`, `workspaceMembershipService.addMember/remove/updateRole` (the last three are Wave 8b but the wiring is in place).

- **API routes (`apps/web/app/api/`):**
  - **`/api/workspaces` (GET list, POST create stub)** — list returns the user's workspaces (today: just the personal one). POST is permitted but disabled in UI (Wave 8b enables multi-workspace per user).
  - **`/api/workspaces/[id]` (GET, PATCH, DELETE)** — get + update name/slug; DELETE disabled by 403 in Wave 8 (cannot delete sole workspace).
  - **`/api/workspaces/[id]/members` (GET list)** — returns membership rows (today: one entry).
  - **`/api/workspaces/[id]/activity` (GET)** — paginated activity feed.
  - **`/api/crdt/token` (POST)** — body `{ entryId }`. Verifies the user can write the BlockDocument for that entry; issues a 5-minute JWT for the Hocuspocus connection. Header signed with `CRDT_JWT_SECRET`.
  - **`/api/blockdocs/[entryId]/persist` (POST, INTERNAL)** — called by Hocuspocus extension to persist Yjs state. Authenticated via `x-crdt-secret` (timing-safe compare; separate from CRON_SECRET). Body: `{ state: base64, snapshot: lexicalJson, version: number }`.
  - **All existing routes** — auth resolution updated to extract `currentWorkspaceId` from the JWT and pass it into the service call.

- **React Query hooks (`apps/web/lib/hooks/`):**
  - `use-workspaces.ts` (NEW) — `useWorkspaces`, `useWorkspace`, `useUpdateWorkspace`, `useWorkspaceMembers`.
  - `use-activity.ts` (NEW) — `useActivityFeed(workspaceId, filters)`, paginated.
  - `use-realtime-document.ts` (NEW) — wraps the Hocuspocus client. Returns `{ ydoc, provider, presence, isConnected }`. Used by `context-block-editor.tsx`.
  - **All existing hooks** — query key factory at `lib/queries/keys.ts` extended with `workspaces.*` and `activity.*` namespaces. Existing keys like `context.list()` parameterize on workspaceId implicitly via the API call (server resolves; client doesn't need to pass it explicitly today since there's only one workspace, but the cache key includes `currentWorkspaceId` so future workspace switching invalidates correctly).

- **UI components (`apps/web/components/`):**
  - **`components/workspace/workspace-switcher.tsx` (NEW)** — sidebar header dropdown.
  - **`components/workspace/workspace-settings-page.tsx` (NEW)** — at `/settings/workspace`.
  - **`components/workspace/member-list.tsx` (NEW)** — used by settings page.
  - **`components/activity/activity-feed-view.tsx` (NEW)** — page-level component for `/activity`.
  - **`components/activity/activity-event-row.tsx` (NEW)** — single-row renderer with verb formatting per event type.
  - **`components/activity/activity-filters.tsx` (NEW)** — filter sidebar.
  - **`components/realtime/presence-avatars.tsx` (NEW)** — avatar stack for connected users in the editor.
  - **`components/realtime/collaborative-cursor.tsx` (NEW)** — cursor + selection decoration via Lexical.
  - **`components/context/context-block-editor.tsx`** — modified: replaces snapshot-only autosave plugin with `CollaborationPlugin` from `@lexical/yjs`, mounts `presence-avatars` + `collaborative-cursor`. Falls back to legacy autosave when realtime connection fails.
  - **`components/editor/collaboration-plugin.tsx` (NEW)** — Lexical plugin wrapping `@lexical/yjs` `CollaborationPlugin` with our connection lifecycle.
  - **`app/(app)/layout.tsx`** — extended with workspace switcher in sidebar header.
  - **`app/(app)/activity/page.tsx` (NEW)** — `/activity` route.
  - **`app/(app)/settings/workspace/page.tsx` (NEW)** — `/settings/workspace` route.
  - **`components/layout/app-sidebar.tsx`** — adds nav link for "Activity".

- **MCP tools (`apps/web/lib/mcp/tools/workspace-tools.ts` NEW):**
  - `list_workspaces()` — returns the user's workspaces.
  - `get_workspace(id?)` — returns the named workspace or current default.
  - `get_activity_events(workspaceId?, eventType?, since?, limit?)` — paginated activity feed. Tool count: **73 → 76**.
  - **All existing 73 tools** — handler files updated. The handler signature stays `(userId, name, args)` but the dispatch resolves `workspaceId` via `workspaceContextService.resolveDefaultWorkspaceId(userId)` before delegating to the service. No client-visible breaking change.

- **Zustand store (`apps/web/lib/stores/ui-store.ts`):**
  - `currentWorkspaceId: string | null` — persisted via `@ascend/storage`. Set after login. Used as a client-side hint; the server resolves authoritatively.
  - `presenceOverlayEnabled: boolean` — persisted; default true.

- **Cron / queues:**
  - **No new cron jobs.** Activity events are written synchronously by the originating mutation. The Wave 7 nightly retention compactor is unaffected.

- **Infrastructure:**
  - **New Dokploy application** — `ascend-crdt` running the Hocuspocus server image. Domain `crdt.ascend.nativeai.agency`. Env: `DATABASE_URL` (read-only access to `BlockDocument` for persistence reads), `CRDT_JWT_SECRET`, `CRDT_PERSIST_URL` (the web app's `/api/blockdocs/[entryId]/persist` endpoint), `CRDT_PERSIST_SECRET`. Deployment: GitHub provider auto-deploy on push to main, build from `apps/crdt/Dockerfile`.
  - **Web app env additions** — `CRDT_JWT_SECRET` (matches CRDT app), `CRDT_WS_URL` (`wss://crdt.ascend.nativeai.agency`), `CRDT_PERSIST_SECRET`.
  - **GitHub Actions secrets** — `CRDT_JWT_SECRET` and `CRDT_PERSIST_SECRET` for E2E test workflows if added.

## Data Model Changes

```prisma
enum WorkspaceRole {
  OWNER
  ADMIN
  EDITOR
  VIEWER
}

enum MembershipStatus {
  PENDING
  ACTIVE
  REMOVED
}

enum ActivityEventType {
  WORKSPACE_CREATED
  MEMBER_ADDED
  MEMBER_REMOVED
  MEMBER_ROLE_CHANGED
  NODE_CREATED
  NODE_DELETED
  NODE_RESTORED
  NODE_BRANCHED
  LINK_CREATED
  LINK_REMOVED
}

model Workspace {
  id          String                  @id @default(cuid())
  slug        String                  @unique
  name        String
  ownerId     String
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  owner       User                    @relation("WorkspaceOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  memberships WorkspaceMembership[]
  activity    ActivityEvent[]

  @@index([ownerId])
}

model WorkspaceMembership {
  id           String           @id @default(cuid())
  workspaceId  String
  userId       String
  role         WorkspaceRole
  status       MembershipStatus @default(ACTIVE)
  invitedAt    DateTime?
  acceptedAt   DateTime?
  removedAt    DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  workspace    Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([userId, status])
}

model ActivityEvent {
  id          String            @id @default(cuid())
  workspaceId String
  userId      String
  eventType   ActivityEventType
  payload     Json
  createdAt   DateTime          @default(now())

  workspace   Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User              @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([workspaceId, createdAt(sort: Desc)])
  @@index([workspaceId, eventType, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
}
```

For every existing tenant table (`Goal`, `Todo`, `ContextEntry`, `Category`, `BlockDocument`, `File`, `ExtractionJob`, `ContextLink`, `ContextMap`, `Database`, `DatabaseField`, `DatabaseRow`, `DatabaseView`, `LlmUsage`, `ProgressLog`):

```prisma
// added to each model
workspaceId String
workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
@@index([workspaceId])
```

Wave 7's three tables already have `workspaceId String?`; the Wave 8 migration backfills then alters to `NOT NULL`.

CHECK constraints (none new; existing CHECKs unaffected).

### Migration plan

Hand-written migrations, four phases:

**Migration 1 (`20260507000001_add_workspaces`)** — additive, no risk.
- Create `WorkspaceRole`, `MembershipStatus`, `ActivityEventType` enums.
- Create `Workspace`, `WorkspaceMembership`, `ActivityEvent` tables with all indexes.

**Migration 2 (`20260507000002_seed_personal_workspaces`)** — data migration, idempotent.
- For every `User` row that does not already own a workspace, create a `Workspace` (slug = `personal-<userId-suffix>` or user email-derived; name = "Personal"); insert `WorkspaceMembership` (role=OWNER, status=ACTIVE).
- Hand-written SQL with `INSERT ... SELECT ... WHERE NOT EXISTS`. Idempotent.

**Migration 3 (`20260507000003_add_workspace_id_to_entities`)** — additive, no constraint enforcement.
- Add `workspaceId TEXT` (nullable) to all 15 entity tables.
- Add foreign key constraint to `Workspace`.
- Add index on `workspaceId` per table.
- Run a separate backfill query inside the migration: `UPDATE "Goal" g SET "workspaceId" = (SELECT w.id FROM "Workspace" w WHERE w."ownerId" = g."userId" LIMIT 1)` and equivalent for each table. Single-user system has 1:1 between userId and workspaceId, so the backfill is deterministic.

**Migration 4 (`20260507000004_finalize_workspace_id`)** — destructive (NOT NULL flip), gated.
- Pre-flight: count rows with `workspaceId IS NULL` across every table. Refuse if any exist.
- `ALTER TABLE ... ALTER COLUMN "workspaceId" SET NOT NULL` on every table including the three Wave 7 tables.
- This migration MUST be run after Migration 3 has propagated and after a verification query confirms zero nulls.

All four are additive in the sense that no existing rows are deleted. The only destructive change is the NOT NULL flip in Migration 4, which is gated.

`search_vector` is untouched (Safety Rule 6 preserved). Each migration is hand-written per the wave's discipline.

## API Contract

### `GET /api/workspaces`

Returns the user's workspaces (today: array of one).

Response:
```json
{
  "workspaces": [
    { "id": "ck...", "slug": "personal-abc", "name": "Personal", "role": "OWNER", "memberCount": 1 }
  ]
}
```

### `GET /api/workspaces/[id]`

Single workspace + computed member count.

Response:
```json
{
  "id": "ck...",
  "slug": "personal-abc",
  "name": "Personal",
  "ownerId": "ck...",
  "createdAt": "...",
  "memberCount": 1,
  "myRole": "OWNER"
}
```

### `PATCH /api/workspaces/[id]`

Body: `{ name?, slug? }`. OWNER only.

### `DELETE /api/workspaces/[id]`

Returns 403 with body `{ error: "Cannot delete the only workspace. Create another workspace first." }` in Wave 8 (always; user only has one). Wave 8b enables this path conditionally.

### `GET /api/workspaces/[id]/members`

Response:
```json
{
  "members": [
    { "userId": "ck...", "displayName": "Amadej", "email": "amadej@...", "role": "OWNER", "status": "ACTIVE", "joinedAt": "..." }
  ]
}
```

### `GET /api/workspaces/[id]/activity`

Query params: `eventType?` (filter), `since?` (ISO date), `cursor?`, `limit?` (default 20, max 100).

Response:
```json
{
  "events": [
    {
      "id": "ck...",
      "userId": "ck...",
      "actorDisplayName": "Amadej",
      "eventType": "NODE_CREATED",
      "payload": { "nodeType": "CONTEXT_ENTRY", "nodeId": "ck...", "title": "..." },
      "createdAt": "..."
    }
  ],
  "nextCursor": "ck..." // null if no more
}
```

### `POST /api/crdt/token`

Body: `{ entryId: string }`.

Response:
```json
{
  "token": "<jwt>",
  "wsUrl": "wss://crdt.ascend.nativeai.agency",
  "documentName": "blockdoc:<entryId>",
  "expiresAt": "<iso>"
}
```

The token's `aud` is `crdt`, payload includes `userId`, `workspaceId`, `entryId`, `permissions: ["read", "write"]`. Hocuspocus's `onAuthenticate` verifies signature + checks `documentName` matches `blockdoc:<entryId>` to prevent cross-document token use.

### `POST /api/blockdocs/[entryId]/persist` (INTERNAL)

Header: `x-crdt-secret: <CRDT_PERSIST_SECRET>`.
Body: `{ state: base64-yjs-state, snapshot: lexicalJsonString, version: number }`.

Persists the Yjs binary state, the Lexical JSON snapshot, and the version counter into `BlockDocument`. Triggers `extractedText` recompute via the existing `block-document-service.persistSnapshot` path. Triggers `versioningService.scheduleSnapshot(EDIT_DEBOUNCED)` for Wave 7 history.

Response: `{ ok: true }` or 401/400.

### Existing routes — auth resolution change

Every existing route's `validateApiKey(request)` / `authenticate(request)` now returns `{ userId, workspaceId }` instead of `{ userId }`. The route passes both into the service call. No client-visible signature changes; the workspace is always implicit.

## UI Flows

### Real-time editing (single user, multi-tab)

1. User opens a note in tab A. `context-block-editor` mounts → calls `POST /api/crdt/token` → connects to Hocuspocus over WS.
2. User opens the same note in tab B (different tab, same browser). Same flow.
3. User edits in tab A → Yjs delta → Hocuspocus broadcasts → tab B applies. Median latency under 100ms LAN.
4. Tab A presence avatar shows user; tab B presence avatar shows user (one user, two presence sessions). Cursor in tab A renders a remote-cursor decoration in tab B.
5. Hocuspocus persists the Yjs state via `POST /api/blockdocs/[entryId]/persist` every 5 seconds (debounced) AND on disconnection.
6. User closes tab A. Tab B continues. Reload tab B → state restored from `BlockDocument.state`.

### Workspace settings

1. User clicks workspace switcher in sidebar header → dropdown → "Workspace settings".
2. Page renders: name + slug (editable inline), member list (one row), invite button (disabled, tooltip), delete button (disabled, tooltip).
3. Editing name: click → input → save → toast "Workspace renamed". `useUpdateWorkspace` invalidates `queryKeys.workspaces.detail(id)`.

### Activity feed

1. User clicks "Activity" in sidebar nav.
2. Page renders the last 20 events for the current workspace, reverse-chronological.
3. Each row: actor avatar + name + verb + subject + relative timestamp. Click on a NODE_CREATED row → navigates to that entry. Click NODE_DELETED → no-op (entity gone) but shows the title from payload.
4. Filter sidebar: event type checkboxes, date range, actor dropdown (single entry today). Filters update via React Query cache key.
5. "Load more" button at the bottom — cursor pagination via `nextCursor`.

### Workspace switcher

1. User clicks dropdown chevron in sidebar header (next to workspace name).
2. Dropdown shows: workspace list (one entry today), separator, "Workspace settings" link.
3. Clicking the workspace entry is a no-op in Wave 8 (only one workspace exists). Wave 8b will enable switching.

## Cache Invalidation

| Mutation | Invalidates |
|---|---|
| `useUpdateWorkspace` | `queryKeys.workspaces.detail(id)`, `queryKeys.workspaces.list()` |
| `useUpdateMember` (Wave 8b) | `queryKeys.workspaces.members(workspaceId)`, `queryKeys.activity(workspaceId)` |
| Any Wave-7-style mutation that fires an activity event | additionally invalidates `queryKeys.activity(workspaceId)` so the feed re-renders. Existing cross-domain invalidations (context, goals, todos, dashboard, graph) remain unchanged. |
| Workspace switch (Wave 8b) | invalidate ALL workspace-scoped query keys (`queryKeys.context.*`, `goals.*`, `todos.*`, `dashboard()`, `versions.*`, `graph.*`, `activity.*`, `workspaces.members(*)`). The cache is functionally a per-workspace cache; switching is a full clear. |
| CRDT-driven block edits | NOT invalidated through React Query. The `useRealtimeDocument` hook holds the Y-doc; React Query's BlockDocument cache is bypassed for the active document. On disconnect or close, the persist hook fires which writes via `block-document-service.persistSnapshot`; the existing Wave 3 invalidation chain runs (`context.detail(entryId)`, `context.search`, `versions.list(...)`). |

## Infrastructure Changes

### New Dokploy application: `ascend-crdt`

- **Source:** monorepo `apps/crdt/`, Dockerfile multi-stage build.
- **Domain:** `crdt.ascend.nativeai.agency`. WebSocket-capable (Dokploy + Traefik defaults handle WS upgrade automatically).
- **Auto-deploy:** GitHub provider on push to main. Same repo as web app.
- **Env vars:** `DATABASE_URL` (read-only role recommended), `CRDT_JWT_SECRET`, `CRDT_PERSIST_URL` (web app's persist endpoint), `CRDT_PERSIST_SECRET`.
- **Resource sizing:** start small (256 MiB RAM, 0.5 CPU). WebSocket connections are lightweight; scale only if presence + cursor traffic becomes meaningful.
- **Health check:** `GET /healthz` returns `{ ok: true, connections: <n> }`.

### Web app env additions

`CRDT_JWT_SECRET`, `CRDT_WS_URL`, `CRDT_PERSIST_SECRET`. Set in Dokploy and locally in `.env.local`.

### CDN / TLS / DNS

`crdt.ascend.nativeai.agency` A record points to dokploy-personal. Traefik handles TLS via Let's Encrypt automatically.

## Danger Zones Touched

This wave introduces 4 new danger zones. Existing DZ-1 through DZ-20 are not directly modified, but DZ-2 (`search_vector`) discipline is preserved (every Wave 8 migration is hand-written and additive aside from the gated NOT NULL flip), and DZ-8 (ContextLink.userId denormalization) is extended with workspaceId denormalization to keep multi-tenant joins fast.

- **DZ-21 (NEW): Backfill correctness on the workspaceId NOT NULL flip.** If any row in any of 18 tables has `workspaceId IS NULL` when Migration 4 runs, the migration aborts with a clear error. Mitigations: (a) Migration 3 backfills via `UPDATE ... SELECT FROM "Workspace" WHERE "ownerId" = ...` which is deterministic for a single-user-per-row data model; (b) Migration 4 pre-flight runs a `COUNT(*) WHERE workspaceId IS NULL` for each table and refuses if any non-zero; (c) Dokploy database snapshot taken immediately before the migration set starts (via Dokploy console); (d) the four migrations are deployed as a single batch under `prisma migrate deploy` so failure rolls back consistently; (e) the Wave 7 saved sessions show retention is enforced and table sizes are bounded, so the backfill query window is small enough to finish in well under the build's 5-minute deploy window.

- **DZ-22 (NEW): Cross-tenant data leak via incomplete workspaceId filter.** Wave 8 modifies ~30 service methods to add `workspaceId` to every `where` clause. Missing one means a future second user sees data from the first user's workspace. Mitigations: (a) `permissionService.canPerform` is the gate at every mutation, blocking writes that target wrong workspace; (b) read paths still need explicit `workspaceId` filter — `ascend-reviewer` audits every modified service; (c) integration smoke: spin up a second test user during the wave's UI verification, attempt to read User A's notes via User B's API key, expect 403/404; (d) `ascend-security` audits every modified handler at wave close.

- **DZ-23 (NEW): Hocuspocus auth bypass / cross-document token reuse.** The CRDT JWT is short-lived (5 min) but if a token leaks or is misused, it could grant write access to the wrong document. Mitigations: (a) token's `documentName` claim is checked against the connection's requested document in `onAuthenticate`; mismatch = 403; (b) CRDT_JWT_SECRET is separate from the web app's main JWT secret (compromise of one does not cascade); (c) the persist endpoint requires `CRDT_PERSIST_SECRET`, separate from JWT — server-to-server only; (d) all CRDT traffic over WSS (Let's Encrypt TLS); (e) `ascend-security` audits the auth flow in Phase 4.

- **DZ-24 (NEW): Yjs state divergence / persistence inconsistency.** If the persist endpoint fails or is slow, a tab that disconnects may lose edits that were CRDT-shared but not yet persisted. Mitigations: (a) Hocuspocus `extension-database` model: persist on every debounced 5s checkpoint AND on `onDisconnect`; (b) persist endpoint is idempotent (full state writes overwrite); (c) on the web app side, `block-document-service.persistSnapshot` retains the existing 1 MiB cap (DZ-10) so a runaway Y-doc cannot blow the column; (d) on the client, the `useRealtimeDocument` hook keeps a per-doc IndexedDB persistence layer (`y-indexeddb`) so a closed tab that did not flush has a recovery snapshot; (e) reconnect logic merges the IndexedDB state with the server state via Yjs's CRDT semantics — convergence is mathematically guaranteed.

## Out of Scope

The following are explicitly deferred to a future wave (most likely **Wave 8b**, planned separately):

- **Sending invitations.** Wave 8 schema includes `WorkspaceMembership.invitedAt/acceptedAt/status=PENDING` but no UI or route creates pending memberships. Wave 8b adds an invite flow (email, accept link, role assignment).
- **Multi-member workspaces.** Wave 8 supports the data model but never has more than one ACTIVE membership per workspace. Wave 8b enables real collaboration.
- **Per-node permission overrides** (private to me / shared with X / open to workspace). Wave 8 enforces only workspace-level membership; Wave 8b adds a `NodePermission` table with explicit overrides.
- **Branching merge UI.** Wave 7 promised this would land in Wave 8. Defer to Wave 8b. The Wave 7 `DERIVED_FROM` link type is enough for the merge UI to be additive.
- **Public publishing.** No `(public)` route group, no `/public/:workspaceSlug/:pageSlug` endpoint, no reader-mode renderers, no password gating, no sitemap. Wave 8b adds these.
- **Comments + threads.** No `Comment` or `CommentThread` table. Wave 8b adds them anchored to block IDs.
- **@mentions.** No mention parsing, no notification fanout. Wave 8b implements both.
- **Notifications (in-app, email).** No `Notification` table. No email infra. Wave 8b adds.
- **Billing.** No per-seat pricing, no plan tiers. Wave 8b adds if monetizing.
- **Workspace creation by users.** Wave 8 only creates the personal workspace via backfill. Users cannot create additional workspaces in Wave 8 UI (the route is implemented but disabled in UI). Wave 8b enables this once it makes product sense.
- **Workspace switching UI.** The dropdown shows the workspace list but clicking is a no-op. Wave 8b enables the switch when more than one workspace exists.
- **Audit log retention policy.** `ActivityEvent` rows accumulate indefinitely in Wave 8. Retention is a polish item for whichever wave next touches retention compaction.
- **Deleting a workspace.** DELETE returns 403 in Wave 8 (cannot delete sole workspace). Wave 8b enables it conditionally.
- **Mobile presence/cursors.** Wave 6 (mobile) consumes the CRDT runtime when it ships, but Wave 8 doesn't write mobile-specific UI.

## Open Questions

1. **Should `apps/crdt/` share the same database connection pool as `apps/web/`, or have its own read-only role?** Recommendation: **separate read-only role** for the CRDT app's `DATABASE_URL` (it only reads `BlockDocument` for initial state hydration). All writes flow back through `apps/web/`'s `/api/blockdocs/[entryId]/persist`. Decided in Phase 4.
2. **Is `@ascend/crdt-shared` actually needed?** Likely no. Hocuspocus document-name conventions are simple enough to inline. Defer creation; revisit at Phase 5 review.
3. **Does the workspace switcher dropdown need a "Create workspace" entry in Wave 8 even though creation is disabled?** Recommendation: **no**. Hide entirely until Wave 8b. Reduces the ghost-feature surface.
4. **Does `User.email` ever need to be displayed in the member list?** Today the only member is the user themselves; email feels redundant. Recommendation: **omit email**, show display name only. Add email when Wave 8b ships invitations.
5. **Should `ActivityEvent.payload` include the entity title for `NODE_DELETED` events?** Recommendation: **yes** — at delete time, capture title into payload so the activity feed can show "Deleted note: <title>" even though the entity is gone. Decided in Phase 7.
6. **Does the CRDT token need `permissions: ["read", "write"]` granularity?** Wave 8 has only owners; today every token is `["read","write"]`. Wave 8b will need read-only tokens for VIEWER role. Pre-implement the field now (forward-compat) but only ever issue `["read","write"]` in Wave 8.
7. **Lexical CRDT upgrade — is `@lexical/yjs` v2 production-ready?** Decided in Phase 5 review. Fallback: a custom Yjs binding via Lexical's command pattern. The web search at Phase 5 start verifies the v2 binding's release status against `lexical` and `@lexical/yjs` npm versions.
8. **Should presence avatars show in the editor toolbar OR float over the document?** Recommendation: **toolbar** for v1 (less visual noise). Floating / margin presence is a polish item.

## Success Test (smoke at wave close)

Manual smoke after `ax:verify-ui` passes:

1. **Two-tab convergence.** Open the same note in two browser tabs. Edit in tab A: confirm tab B shows the edit within 250ms. Edit in tab B simultaneously: confirm both tabs converge after a few seconds (Yjs CRDT semantics).
2. **Reconnect resilience.** Disconnect Wi-Fi for 30s while typing in tab A. Reconnect. Confirm tab A and tab B converge to the post-reconnect state.
3. **Cross-device sync.** Open the same note on laptop and phone (simulate via different browser profiles). Edit on laptop: see it appear on phone within 1s.
4. **Presence avatars.** Confirm the editor toolbar shows an avatar for the current user. Open a second tab: confirm two avatars (one per session).
5. **Collaborative cursor.** Confirm a remote cursor decoration appears in tab B at the position of tab A's cursor.
6. **Workspace settings.** Navigate `/settings/workspace`. Edit name → save → confirm sidebar header shows the new name.
7. **Workspace switcher.** Click sidebar header dropdown. Confirm one workspace listed. Confirm "Workspace settings" link works. Confirm clicking the workspace entry is a no-op.
8. **Activity feed.** Create a note. Navigate `/activity`. Confirm a `NODE_CREATED` event row appears. Click the row → navigates to the new note.
9. **Activity filters.** Filter by event type "Node restored". Confirm filtered list correctness with a previously-restored Wave 7 entry.
10. **MCP — `list_workspaces`.** Restart MCP client. Confirm `list_workspaces()` returns one entry with slug, name, role=OWNER, memberCount=1.
11. **MCP — `get_activity_events`.** Confirm tool returns the activity created in step 8.
12. **MCP — existing tool fidelity.** Run `list_context()` and `list_goals()`. Confirm same results as before Wave 8 (workspaceId is implicit, single user, single workspace → no behavioral change).
13. **Permission gate.** Manually set a different `workspaceId` in a Prisma query (test scaffold) → confirm `permissionService.canPerform` returns false → service throws 403.
14. **Migration replay on a fresh database.** Provision a clean Postgres → run `prisma migrate deploy` from scratch → confirm all 4 Wave 8 migrations apply cleanly. (Catches accidental order dependencies on existing data.)
15. **Hocuspocus health check.** Curl `crdt.ascend.nativeai.agency/healthz` → confirm `{ ok: true, connections: <n> }`.
