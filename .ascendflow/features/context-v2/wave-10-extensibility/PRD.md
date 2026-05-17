# Wave 10: Extensibility (MCP federation + GitHub embedded data)

**Slug:** `context-v2` / `wave-10-extensibility`
**Created:** 17. 5. 2026
**Status:** planning
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md) (W10 section, "Extensibility (~3-4 weeks)")
**Wave sizing:** 3 weeks per VISION; target 13-15 working days at the cadence Waves 5/7/8/9 hit.

## Problem

Ascend's 79 MCP tools cover its own knowledge base completely. But the user's working life lives across other tools too: GitHub issues, Linear projects, Slack threads, Notion docs. To use Ascend as the **operating system for thinking**, that external context has to be reachable from inside Ascend, AND Ascend's MCP surface has to coexist with the user's other MCP servers from a single AI client's perspective.

Wave 10 covers two pillars (the other two — custom views and plugin API — are deferred to a later wave per discovery on 17. 5. 2026):

1. **MCP server federation.** A user can register external MCP servers in Ascend's settings. Ascend's `/api/mcp` endpoint then surfaces both its own 79 tools AND the federated servers' tools (with auto-prefixed names) when a host like Claude/Cursor/etc. calls `tools/list`. When the host invokes a federated tool, Ascend proxies the JSON-RPC call to the upstream server, returns the result. Result: one MCP connection from Claude reaches both Ascend and the user's other servers without the user juggling multiple connections in Claude's settings.

2. **Embeddable external data: GitHub.** A user can connect their GitHub account (PAT paste) and create an EXTERNAL_DATABASE entry that surfaces GitHub Issues and Pull Requests as virtual Wave 5 database rows. Read-only. Filtering/sorting via the existing Wave 5 view machinery. Wikilinks like `[[gh-issue-42]]` resolve to the row in the EXTERNAL_DATABASE. Repos browse is a stretch. Discussions, Releases, Projects, Labels-as-databases all defer.

The wave deliberately does NOT include:
- Custom view registration / iframe-sandboxed plugins (deferred to W10b or W11)
- Plugin API with commands/panels/MCP-tool-like handlers (deferred to W10b or W11)
- Linear, Slack, Notion, or any non-GitHub adapter (deferred)
- Writing back to GitHub (read-only in W10; write-back is a security + scope problem worth its own pass)
- A plugin marketplace / signing / review infrastructure (no plugins to host)

## User Story

As a user, I want to connect my external MCP servers to Ascend so that when Claude or Cursor talks to Ascend, they ALSO see my Linear / Notion / GitHub MCP tools — one connection covers everything. And I want my GitHub issues + PRs to appear inside Ascend as a database so I can filter, board-group, link to them from my notes, and treat them as first-class graph nodes without leaving Ascend or syncing them into a third system.

As an AI agent connected via MCP to Ascend, I want every federated tool to be discoverable via `tools/list` with an unambiguous name (`linear__create_issue`, `github-personal__list_repos`) so collisions never happen and I can reason about which server owns each tool.

## Success Criteria

### Functional — MCP federation

- [ ] **`McpServerConnection` table (NEW).** Columns: `id`, `userId`, `workspaceId`, `name` (1-50 chars, slug-friendly; auto-derives a `__` prefix), `slug` (1-30 chars, unique per user), `transport` (`HTTP_STREAMABLE` | `SSE`), `endpoint` (URL, 1-2000 chars), `authType` (`NONE` | `API_KEY` | `BEARER`), `encryptedCredentials` (bytea | text; AES-256-GCM ciphertext via the new secrets service), `enabled` (Boolean default true), `lastListedAt` (DateTime nullable), `lastListError` (text nullable), `createdAt`, `updatedAt`. `@@unique([userId, slug])` so the prefix is stable. CHECK constraint: `octet_length(encryptedCredentials) <= 4096`. Indexes: `[userId, enabled]`, `[workspaceId]`.
- [ ] **`McpServerToolCache` table (NEW).** Per-connection cached tool descriptors so `tools/list` is fast and works while the upstream is briefly unreachable. Columns: `id`, `mcpServerConnectionId` (FK CASCADE), `userId`, `workspaceId`, `toolName` (string; UN-PREFIXED, what the upstream returned), `description` (text), `inputSchema` (JSONB, full JSON Schema as the upstream emitted it), `cachedAt`. `@@unique([mcpServerConnectionId, toolName])`. CHECK constraint: `octet_length(inputSchema::text) <= 32768`.
- [ ] **Secrets service (NEW).** `apps/web/lib/services/secrets-service.ts` exporting `encryptSecret(plaintext)` and `decryptSecret(ciphertext)`. AES-256-GCM. Key from `SECRETS_ENCRYPTION_KEY` env (64 hex chars / 32 bytes; module-load assert >= 32 raw bytes and distinct from `AUTH_JWT_SECRET` / `CRDT_JWT_SECRET` / `CRDT_PERSIST_SECRET`). Each ciphertext: 12-byte IV + ciphertext + 16-byte auth tag, base64 envelope. Pure function; no logging of plaintext.
- [ ] **MCP federation service (NEW).** `apps/web/lib/services/mcp-federation-service.ts`. Methods: `listConnections(userId, workspaceId)`, `getConnection(userId, workspaceId, id)`, `createConnection(userId, workspaceId, input)`, `updateConnection(userId, workspaceId, id, input)`, `deleteConnection(userId, workspaceId, id)`, `testConnection(userId, workspaceId, id)` (calls upstream `initialize` then `tools/list`, returns either healthy or descriptive error), `refreshToolCache(userId, workspaceId, id)` (calls `tools/list`, upserts `McpServerToolCache` rows). All userId+workspaceId-scoped. Permission gates via `permissionService` for the writes; reads bypass when single-user (matches Wave 8 pattern).
- [ ] **MCP federation proxy (NEW).** `apps/web/lib/mcp/federation-proxy.ts`. Given a federated tool call (after Ascend's route strips the prefix and identifies the source `McpServerConnection`), forwards the JSON-RPC `tools/call` to the upstream endpoint via the correct transport (`HTTP_STREAMABLE` POST or `SSE` GET-then-SSE-stream), with auth headers, returns the result. Timeout 30s. Errors mapped to MCP error envelope. Never throws to the caller; returns `isError: true` on upstream failure.
- [ ] **Ascend `/api/mcp` route extends to federate.** `apps/web/app/api/mcp/route.ts`: when Claude calls `tools/list`, the response includes 79 native tools AND the prefixed federated tools (read from `McpServerToolCache` rows where `enabled = true`, scoped by the authenticating user's `userId + workspaceId`). When Claude calls `tools/call` with a name matching `<slug>__<toolName>`, the route splits on `__`, looks up the connection, and delegates to `federation-proxy.ts`. Naming check: `__` (double underscore) is the prefix delimiter; tool names containing `__` outside the prefix work because we split only on the FIRST `__`.
- [ ] **One-direction enforced.** Ascend never CALLS federated tools server-side (no service-layer code invokes `federationProxy` from Ascend's own tool handlers). The proxy is only reachable from `/api/mcp` in response to an upstream Claude-like host. Documented as DZ-28.
- [ ] **Settings UI (NEW).** `apps/web/app/(app)/settings/mcp-servers/page.tsx` with `apps/web/components/settings/mcp-server-list.tsx`, `mcp-server-form-dialog.tsx`, `mcp-server-test-button.tsx`. List shows name, slug, endpoint, transport, enabled toggle, last-list status (Healthy / Error / Never tested). Click → edit dialog. "+ New connection" → form. Delete with confirm. Test button calls `mcpFederationService.testConnection` and surfaces the result inline. Adds a "MCP Servers" link to the existing `/settings` nav.
- [ ] **API routes (NEW, 6).** `GET /api/mcp-servers` (list), `POST /api/mcp-servers` (create), `GET /api/mcp-servers/[id]` (read; never returns `encryptedCredentials`), `PATCH /api/mcp-servers/[id]` (update; if credentials field present, re-encrypts), `DELETE /api/mcp-servers/[id]`, `POST /api/mcp-servers/[id]/test` (test + refresh tool cache).
- [ ] **MCP tools (round 10, 4 new, total 79 → 83).** `list_mcp_connections`, `test_mcp_connection`, `enable_mcp_connection`, `disable_mcp_connection`. Read + state-flip only, no create/delete via MCP (those require credential entry, which belongs in the UI). Federated `tools/call` proxying is NOT counted in the tool count — federated tools are USER-INSTALLED, not Ascend-native.

### Functional — GitHub embedded data

- [ ] **`ExternalDataSource` table (NEW).** Columns: `id`, `userId`, `workspaceId`, `provider` (enum `GITHUB` initially; future `LINEAR` / `SLACK`), `name` (1-100 chars, user-facing label), `authType` (`PAT` | `OAUTH`; W10 uses `PAT` only), `encryptedCredentials` (AES-256-GCM via secrets service), `config` (JSONB: per-provider config; GitHub example: `{ scope: "user" | "org", orgSlug?: string, repoFilter?: { include: string[], exclude: string[] } }`), `enabled` (Boolean), `lastRefreshedAt` (DateTime nullable), `lastRefreshError` (text nullable), `createdAt`, `updatedAt`. Indexes: `[userId, provider]`, `[workspaceId]`. CHECK on `encryptedCredentials` and `config` size caps.
- [ ] **`ContextEntryType` extended with `EXTERNAL_DATABASE`.** Migration adds the enum value. ContextEntry rows of type `EXTERNAL_DATABASE` have a 1:1 with `ExternalDataSource` via a new `externalDataSourceId` nullable FK on `ContextEntry`. Existing entries unaffected.
- [ ] **External data adapter pattern (NEW).** `apps/web/lib/external-data/types.ts` defines the `ExternalDataAdapter` interface: `listShapes(): ExternalDataShape[]` (each shape = a virtual table the source exposes; for GitHub: `issues`, `pulls`, `repos`), `getSchema(shape: string): ExternalDataField[]` (mirrors Wave 5 `DatabaseField` schema), `query(shape: string, filters: ExternalDataFilter, pagination): { rows: ExternalDataRow[], nextCursor }`, `getRow(shape: string, remoteId: string): ExternalDataRow | null`. Pure interface; concrete adapter at `apps/web/lib/external-data/adapters/github-adapter.ts`.
- [ ] **GitHub adapter (NEW).** `apps/web/lib/external-data/adapters/github-adapter.ts`. Uses `globalThis.fetch` against `https://api.github.com`. Shapes (must-ship): `issues` (fields: `number`, `title`, `state`, `author`, `assignees`, `labels`, `milestone`, `body`, `commentsCount`, `createdAt`, `updatedAt`, `closedAt`, `htmlUrl`), `pulls` (fields: `number`, `title`, `state`, `draft`, `author`, `baseRef`, `headRef`, `mergedAt`, `closedAt`, `requestedReviewers`, `requestedTeams`, `commentsCount`, `commitsCount`, `additions`, `deletions`, `htmlUrl`). Stretch: `repos`. Defer: `discussions`, `releases`, `projects`. Per-shape schema maps GitHub fields to Wave 5 `DatabaseFieldType` (TEXT / NUMBER / DATE / SELECT / MULTI_SELECT / URL / USER). Query supports filter pushdown for common fields (state, labels, assignee, milestone, repo); other filters fall back to client-side after fetch. Per-request rate-limit budgeting: read `X-RateLimit-Remaining` header, surface "GitHub rate limit exhausted" if < 5.
- [ ] **External data service (NEW).** `apps/web/lib/services/external-data-service.ts`. Methods: `listSources(userId, workspaceId)`, `getSource(userId, workspaceId, id)`, `createSource(userId, workspaceId, input)` (also creates the associated `ContextEntry` of type `EXTERNAL_DATABASE` in a transaction), `updateSource`, `deleteSource` (CASCADE removes the `ContextEntry`), `query(userId, workspaceId, sourceId, shape, filters, pagination)` (returns LRU-cached rows), `refreshSchema(userId, workspaceId, sourceId)` (calls adapter `listShapes` + `getSchema` for each, syncs to a per-source schema cache). All userId+workspaceId-scoped. Permission gates via `permissionService` for writes.
- [ ] **LRU cache + 5-min TTL.** `apps/web/lib/external-data/cache.ts`. Per `(userId, workspaceId, sourceId, shape, filterHash, page)` key. Hit returns cached rows without hitting the upstream. Miss falls through to adapter. Stale-while-revalidate inside the 5-min window. Memory cap: 256 MiB per process (configurable via `EXTERNAL_DATA_CACHE_MAX_MB`).
- [ ] **API routes (NEW, 7).** `GET /api/external-data/sources`, `POST /api/external-data/sources`, `GET /api/external-data/sources/[id]`, `PATCH /api/external-data/sources/[id]`, `DELETE /api/external-data/sources/[id]`, `POST /api/external-data/sources/[id]/refresh-schema`, `POST /api/external-data/sources/[id]/query` (POST not GET because filter payload may be large; body matches `databaseQuerySchema` shape but extended with `shape: string`).
- [ ] **Database view integration.** When `ContextEntry.type === "EXTERNAL_DATABASE"`, `apps/web/components/databases/database-detail.tsx` dispatches to a new `external-database-detail.tsx` that mounts a thin variant of the Wave 5 view switcher: Table + Board ONLY (Calendar / Gallery / Timeline deferred). Reads schema from `ExternalDataSource.config.shapeSchemas[shape]` (cached). Reads rows via `useExternalDataRows(sourceId, shape, filter, sort, page)` React Query hook. Read-only: no `+ Add row`, no inline edit, no `+ Add column`. View config (filter, sort, hidden fields, board group-by) persists per-view to a new lightweight `ExternalDataView` table OR reuses `DatabaseView` with a `sourceShape` discriminator field. (Decision recorded in "Open Questions".)
- [ ] **Wikilink resolution.** `packages/core/src/wikilink.ts` extended: targets matching `gh-issue-<remoteId>`, `gh-pr-<remoteId>` resolve to the EXTERNAL_DATABASE row for the user's first connected GitHub source. Bidirectional backlinks: when an external row is rendered in the detail panel, the existing Wave 1 backlinks panel queries `ContextLink` rows where `toEntryId = <external-row-virtual-entryId>`. Virtual entry IDs use the format `ext:<sourceId>:<shape>:<remoteId>` and never persist as ContextEntry rows; instead, `ContextLink.toEntryId` is allowed to be either a real ContextEntry.id OR a virtual external ID (DZ-29 covers the integrity implications).
- [ ] **Settings UI (NEW).** `apps/web/app/(app)/settings/integrations/page.tsx` + `apps/web/components/settings/external-source-list.tsx`, `external-source-form-dialog.tsx`. List shows provider, name, scope, last-refresh, enabled toggle. + New → provider picker (only `GITHUB` in W10) → PAT paste + scope picker. Test button verifies the PAT scope (calls `https://api.github.com/user`).
- [ ] **`/context` integration.** Creating a new EXTERNAL_DATABASE entry adds it to the `/context` list view with a distinct icon. Search includes external row titles in the result set (text-only; semantic embedding of external rows is out of scope).
- [ ] **MCP tools (round 10b, 3 new, total 83 → 86).** `list_external_sources`, `query_external_data` (read-only, with `sourceId`, `shape`, optional `filter` / `sort` / `cursor`), `refresh_external_schema`. No create/delete via MCP (PAT entry belongs in the UI).

### Quality

- [ ] **federation latency < 2s** (95th percentile, single federated tool call, locally measured against a small reference MCP server like the official `mcp-everything` example).
- [ ] **GitHub Issues table view first render < 500ms** for the user's most recent 25 issues (cache hit) or < 2s (cache miss, single API page).
- [ ] **GitHub list pagination via cursor** (GitHub's `Link: <...>; rel="next"` header). Per-page size 25.
- [ ] **Secrets at rest are AES-256-GCM encrypted with `SECRETS_ENCRYPTION_KEY`.** Key MUST be 64 hex chars (32 bytes) AND distinct from auth + CRDT secrets. Module-load assertion.
- [ ] **No PAT or MCP credential is ever logged.** All log lines that touch `encryptedCredentials` MUST mask via the secrets service. Audit via grep at wave close.
- [ ] **`tsc --noEmit` and `pnpm build` pass at every commit.**
- [ ] **`ascend-security` audit on all new routes + secrets handling: PASS.**
- [ ] **`ascend-migration-auditor` audit on 3 new tables + enum extension: PASS.**
- [ ] **`ascend-reviewer` PASS** on every service / route / hook / component touched.
- [ ] **`ascend-architect` PASS** (no Excalidraw-class leak of provider-specific code into shared packages; adapters stay in `apps/web/lib/external-data/adapters/`).
- [ ] **`ascend-critic` verdict at GOOD or WORLD-CLASS** at wave close.
- [ ] **`ax:verify-ui` PASS** on settings pages + EXTERNAL_DATABASE table + board views + a GitHub federation roundtrip.

### Cross-platform readiness

- [ ] **Shared types in `@ascend/core`.** `McpServerTransport`, `McpAuthType`, `ExternalDataProvider`, `ExternalDataField` types live in `packages/core/src/types/external-data.ts`. Zod schemas for create/update inputs at `packages/core/src/schemas/external-data.ts` and `packages/core/src/schemas/mcp-federation.ts`.
- [ ] **Adapters stay in `apps/web`.** GitHub-specific code lives only in `apps/web/lib/external-data/adapters/github-adapter.ts`. No `octokit` or GitHub SDK imports cross into shared packages.
- [ ] **MCP federation proxy lives in `apps/web`.** Transport handling is web-specific (Node 22 fetch + SSE). Shared types are pure TypeScript at `@ascend/core`.
- [ ] **Mobile (Wave 6) onramp.** API + MCP tools fully agent-usable. MCP host (mobile-side) can list federated tools and view EXTERNAL_DATABASE entries; managing connections (paste PAT, configure scope) is web-only for the foreseeable future. Documented in BACKLOG as "mobile read-only for federated tools, full management on web."

## Affected Layers

- **Prisma schema**: 3 new tables (`McpServerConnection`, `McpServerToolCache`, `ExternalDataSource`), 1 enum extension (`ContextEntryType` += `EXTERNAL_DATABASE`), 1 new FK on `ContextEntry` (`externalDataSourceId` nullable). 4 hand-written migrations (additive, DZ-2-safe; search_vector untouched).
- **Service layer**: 3 new services (`secretsService`, `mcpFederationService`, `externalDataService`), 1 new module (`federation-proxy.ts`).
- **API routes**: 13 new routes (6 mcp-servers + 7 external-data).
- **React Query hooks**: 2 new hook files (`use-mcp-servers.ts`, `use-external-data.ts`). New query key groups: `mcpServers.*`, `externalData.*`.
- **UI components**: 2 new settings sub-pages + ~8 new components (`mcp-server-list`, `mcp-server-form-dialog`, `mcp-server-test-button`, `external-source-list`, `external-source-form-dialog`, `external-database-detail`, `external-row-detail`, and the per-shape table/board view variants).
- **MCP tools**: 7 new tools (4 mcp-server-control + 3 external-data-read), total 79 → 86. Plus the federation PROXY which is not counted as a tool.
- **Zustand store**: minimal — possibly a `mcpServersActiveTab` for settings; no significant state.
- **Shared packages**: `@ascend/core` gains 2 schema files + 1 types file.
- **CLAUDE.md**: 2 new danger zones (DZ-28 federation one-direction, DZ-29 virtual external entry IDs in ContextLink).

## Data Model Changes

```prisma
// New enum value on existing enum
enum ContextEntryType {
  NOTE
  SOURCE
  PROJECT
  PERSON
  DECISION
  QUESTION
  AREA
  DATABASE
  RECORD
  EXTERNAL_DATABASE   // Wave 10
}

// New enums for MCP federation
enum McpServerTransport {
  HTTP_STREAMABLE
  SSE
}

enum McpServerAuthType {
  NONE
  API_KEY
  BEARER
}

// New enums for external data
enum ExternalDataProvider {
  GITHUB
  // LINEAR, SLACK in future waves
}

enum ExternalDataAuthType {
  PAT
  // OAUTH in future waves
}

model McpServerConnection {
  id                  String              @id @default(cuid())
  userId              String
  workspaceId         String
  name                String              // user-facing label, 1-50 chars
  slug                String              // tool prefix, 1-30 chars, [a-z0-9-]+
  transport           McpServerTransport
  endpoint            String              // URL, 1-2000 chars
  authType            McpServerAuthType   @default(NONE)
  encryptedCredentials String?            // AES-256-GCM ciphertext via secretsService
  enabled             Boolean             @default(true)
  lastListedAt        DateTime?
  lastListError       String?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  user                User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace           Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  toolCache           McpServerToolCache[]

  @@unique([userId, slug])
  @@index([userId, enabled])
  @@index([workspaceId])
}
// CHECK constraint added via raw SQL: octet_length("encryptedCredentials") <= 4096

model McpServerToolCache {
  id                     String              @id @default(cuid())
  mcpServerConnectionId  String
  userId                 String
  workspaceId            String
  toolName               String              // upstream, un-prefixed
  description            String?
  inputSchema            Json                // upstream JSON Schema verbatim
  cachedAt               DateTime            @default(now())
  connection             McpServerConnection @relation(fields: [mcpServerConnectionId], references: [id], onDelete: Cascade)

  @@unique([mcpServerConnectionId, toolName])
  @@index([userId])
  @@index([workspaceId])
}
// CHECK constraint added via raw SQL: octet_length("inputSchema"::text) <= 32768

model ExternalDataSource {
  id                    String                @id @default(cuid())
  userId                String
  workspaceId           String
  provider              ExternalDataProvider
  name                  String                // user-facing label, 1-100 chars
  authType              ExternalDataAuthType  @default(PAT)
  encryptedCredentials  String                // required (PAT) AES-256-GCM
  config                Json                  // per-provider: { scope, orgSlug?, repoFilter? }
  enabled               Boolean               @default(true)
  lastRefreshedAt       DateTime?
  lastRefreshError      String?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  user                  User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace             Workspace             @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  contextEntry          ContextEntry?         // 1:1 backref via ContextEntry.externalDataSourceId

  @@index([userId, provider])
  @@index([workspaceId])
}
// CHECK constraints via raw SQL:
//   octet_length("encryptedCredentials") <= 4096
//   octet_length("config"::text) <= 16384

// Existing model addition
model ContextEntry {
  // ... existing fields ...
  externalDataSourceId  String?             @unique
  externalDataSource    ExternalDataSource? @relation(fields: [externalDataSourceId], references: [id], onDelete: SetNull)
}
```

Migrations (4, hand-written, applied via `prisma migrate deploy` per safety rule 6):

1. `20260518000001_wave10_add_enums` — adds 4 new enums + `EXTERNAL_DATABASE` to `ContextEntryType`.
2. `20260518000002_wave10_add_mcp_tables` — creates `McpServerConnection` + `McpServerToolCache` + CHECK constraints + indexes.
3. `20260518000003_wave10_add_external_data_source` — creates `ExternalDataSource` + CHECK constraints + indexes.
4. `20260518000004_wave10_link_context_entry_external` — adds `ContextEntry.externalDataSourceId` (nullable FK, SetNull on delete).

No backfill required; all additive.

## API Contract

### MCP federation

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mcp-servers` | List the user's connections (omits `encryptedCredentials`). |
| `POST` | `/api/mcp-servers` | Create a connection. Body: `{ name, slug?, transport, endpoint, authType, credentials? }`. Encrypts credentials. |
| `GET` | `/api/mcp-servers/[id]` | Read single (omits credentials). |
| `PATCH` | `/api/mcp-servers/[id]` | Update. If `credentials` field present, re-encrypt; otherwise leave existing ciphertext. |
| `DELETE` | `/api/mcp-servers/[id]` | Cascade-delete tool cache. |
| `POST` | `/api/mcp-servers/[id]/test` | Calls upstream `initialize` then `tools/list`. Caches tools on success. Returns `{ healthy: boolean, toolCount?, error? }`. |

The existing `POST /api/mcp` route extends:
- `tools/list`: response now concatenates 79 native tools + all `(McpServerToolCache.toolName -> "<slug>__<toolName>")` rows where the parent connection is `enabled = true` and owned by the authenticating user+workspace.
- `tools/call`: if `params.name.includes("__")`, the route splits on the first `__`, looks up the connection by `slug`, and delegates to `federationProxy.callTool(connection, restOfName, params.arguments)`. Errors map to MCP error envelope.

### External data

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/external-data/sources` | List sources. |
| `POST` | `/api/external-data/sources` | Create source + associated `ContextEntry` of type `EXTERNAL_DATABASE` in a transaction. |
| `GET` | `/api/external-data/sources/[id]` | Read single. |
| `PATCH` | `/api/external-data/sources/[id]` | Update. |
| `DELETE` | `/api/external-data/sources/[id]` | Cascade-deletes the associated `ContextEntry`. |
| `POST` | `/api/external-data/sources/[id]/refresh-schema` | Calls adapter `listShapes` + `getSchema`, persists into `ExternalDataSource.config.shapeSchemas`. |
| `POST` | `/api/external-data/sources/[id]/query` | Body: `{ shape, filter?, sort?, cursor?, perPage? }`. Returns `{ rows, nextCursor, totalCount? }`. |

## UI Flows

### Settings → MCP Servers

1. User clicks Settings → MCP Servers in the sidebar.
2. List shows existing connections + "+ New connection" button.
3. + New connection → Dialog with: Name (auto-derives slug), Transport (radio: HTTP / SSE), Endpoint (URL input), Auth (radio: None / API Key / Bearer), Credentials (password input, only when Auth != None).
4. Save → POST /api/mcp-servers → list refreshes → new row appears with "Test" button.
5. Test button → POST /api/mcp-servers/[id]/test → inline status pill (Healthy / Error / Tool count).
6. Edit pencil → Dialog with same form (credentials field is empty placeholder; leaving it empty preserves the existing encrypted value).
7. Enable toggle in the list row flips `enabled` via PATCH.
8. Delete → Confirm → DELETE → row removed.

### Settings → Integrations (External data)

1. User clicks Settings → Integrations.
2. List shows existing sources + "+ Add integration" button.
3. + Add integration → provider picker (GitHub in W10) → form with: Name (defaults to "GitHub"), Personal Access Token (password input), Scope (radio: My GitHub / Specific organization → org input).
4. Save → POST /api/external-data/sources (encrypts PAT) → also creates the ContextEntry (transaction) → list refreshes.
5. Click row → opens the associated EXTERNAL_DATABASE entry in /context (right-side detail panel shows the database).
6. Delete → Confirm → DELETE → both the source AND the linked ContextEntry are removed.

### /context Map view with EXTERNAL_DATABASE

1. User has a "GitHub Issues" EXTERNAL_DATABASE entry in /context.
2. Clicking it → detail panel mounts external-database-detail.tsx.
3. View switcher (Table | Board) appears; default is Table.
4. Table fetches via useExternalDataRows("issues", filter, sort, page) → renders the GitHub issues with state badge, labels (MULTI_SELECT), assignees (USER multi), milestone, opened-at, etc.
5. Filter bar uses the existing Wave 5 view-config-popover bound to the external schema.
6. Cursor pagination via "Load more" button at bottom (no infinite scroll in v1).
7. Click a row → side Sheet with full row detail + the row's BlockDocument-bearing notes are NOT applicable (rows are virtual); instead, the Sheet has a "Linked notes" section listing every Ascend ContextEntry that wikilinks to this row.
8. Board view groups by State (Open / Closed) by default; user can change via view config.

### MCP host (Claude/Cursor) view

1. Claude connects to Ascend MCP with the user's API key.
2. Calls `tools/list` → response has 79 native + all federated tools (prefixed).
3. Calls `github-personal__list_issues` with args → Ascend's `/api/mcp` route splits the prefix, looks up the github-personal connection, delegates the JSON-RPC `tools/call` to the upstream MCP server, returns the result verbatim.
4. Errors from upstream are passed through with the original error code + message wrapped in Ascend's response envelope.

## Cache Invalidation

Every mutation invalidates query keys. Cross-domain invalidations called out explicitly.

| Mutation | Invalidates |
|----------|-------------|
| `useCreateMcpServer` | `mcpServers.list()` |
| `useUpdateMcpServer` | `mcpServers.list()`, `mcpServers.detail(id)`, `mcpServers.tools(id)` |
| `useDeleteMcpServer` | `mcpServers.list()`, `mcpServers.detail(id)` removed |
| `useTestMcpServer` | `mcpServers.detail(id)`, `mcpServers.tools(id)` |
| `useCreateExternalSource` | `externalData.sources()`, `context.list()` (since a new ContextEntry of type EXTERNAL_DATABASE is created) |
| `useUpdateExternalSource` | `externalData.sources()`, `externalData.source(id)` |
| `useDeleteExternalSource` | `externalData.sources()`, `externalData.rows.all()` for that source, `context.list()`, `context.detail(entryId)` |
| `useRefreshExternalSchema` | `externalData.source(id)` |
| External `useExternalDataRows` query (not a mutation; cache lives 5 min by default via `staleTime`) | n/a |

## Danger Zones Touched

This wave introduces two new danger zones documented in CLAUDE.md.

**DZ-28: MCP federation must stay one-direction.** Ascend's `/api/mcp` route may invoke federated `tools/call`. Ascend's own service layer MUST NOT invoke federated tools server-side (no service-layer code imports `federationProxy.callTool` or similar). The one-direction rule prevents cross-server agent loops (Ascend's tool calls Linear's tool calls back to Ascend's tool calls Linear's …), compounding rate limits, and federated-credential-leak via Ascend's audit log. Enforced by code-review at every wave; documented inline at the proxy module.

**DZ-29: Virtual external entry IDs in `ContextLink`.** When a wikilink resolves to a row inside an EXTERNAL_DATABASE entry, the underlying `ContextLink.toEntryId` may store a virtual ID of the form `ext:<sourceId>:<shape>:<remoteId>` rather than a real `ContextEntry.id`. Mitigations: (a) the wikilink parser flags virtual IDs and the link rendering handles them specifically (deep-link to the EXTERNAL_DATABASE detail panel + auto-scroll to the row); (b) when an `ExternalDataSource` is deleted, a cleanup migration removes orphan `ContextLink` rows where `toEntryId LIKE 'ext:<deletedSourceId>:%'`; (c) Wave 5 RELATION fields explicitly cannot target external rows in W10 (the field-type validator rejects them with a clear error); (d) backlinks queries pre-filter virtual IDs before resolving to titles. Reads bypass userId scoping ONLY when the link target is virtual AND owned by the same user — never cross-user.

## Out of Scope

- **Custom view registration (iframe-sandboxed plugins).** Deferred to W10b or W11.
- **Lightweight plugin API.** Deferred.
- **Linear, Slack, Notion adapters.** Only GitHub in W10.
- **Write-back to GitHub.** Read-only in W10. Issue creation, label assignment, etc., are explicit non-goals.
- **GitHub Discussions, Releases, Projects, Actions runs, Workflow files.** Defer to W11.
- **GitHub App with per-repo permissions.** PAT only in W10.
- **OAuth flow for GitHub.** PAT only in W10.
- **Federated MCP server credential bidirectional sync** (e.g., refreshing OAuth on the federated side). User re-enters credentials manually when they expire.
- **Plugin marketplace, signing, review.** No plugins exist to host.
- **Real-time push from GitHub via webhooks.** On-demand + 5-min cache only.
- **Mobile plugin runtime.** Confirmed deferred indefinitely per VISION.
- **Federated tools surfaced in Ascend's Cmd+K palette.** MCP host only.
- **Cross-workspace sharing of MCP connections or integrations.** Each user's connections are private even within a shared workspace.

## Open Questions

1. **`ExternalDataView` vs reuse `DatabaseView`.** A new lightweight `ExternalDataView` table is more isolated and avoids polluting Wave 5's `DatabaseView` with a discriminator. Reusing `DatabaseView` keeps the view-config UI machinery identical and lets future code path-converge. **Default position: new `ExternalDataView` table.** Resolve before Phase 1.
2. **Schema-cache TTL.** GitHub's schema (field types, label values, milestone list) changes when the user creates new labels in GitHub. Refresh strategy: refresh-on-every-query? Per-day cron? User-triggered? **Default position: cache schema 1 hour, expose "Refresh schema" button in the entry's kebab menu.**
3. **PAT scope hint UI.** GitHub requires the user to pick specific scopes (repo, public_repo, etc.) when creating a PAT. Should the form pre-fill instructions with the exact scopes Ascend needs? **Default position: yes; the form lists "Required scopes: `repo`, `read:user`, `read:org`" with a copy-to-clipboard button.**
4. **Cache eviction policy.** LRU per process; ok for single-process Dokploy deploy. When Wave 8b multi-process scales the web app, we need a shared cache (Redis?). **Default position: keep per-process LRU in W10; revisit at multi-process.**
5. **External row search inclusion.** Including external row titles in `/context` search (hybrid text+semantic) means embedding external row titles into pgvector. Cost + freshness implications. **Default position: text-only search includes external rows (cheap); semantic embedding of external rows defers to W11.**
6. **Federation timeout default.** 30s feels safe for slow Linear / GitHub MCP servers; aggressive for chatty ones. **Default position: 30s with per-connection override via `McpServerConnection.config.timeoutMs`.**
7. **`/settings/integrations` vs `/settings/mcp-servers` IA.** Two separate pages or one merged page with two sections? **Default position: two separate pages, both linked from a top-level Settings nav. Easier to discover.**

## Sized

3 weeks per VISION; target 13-15 working days. Phasing in TASKS.md.
