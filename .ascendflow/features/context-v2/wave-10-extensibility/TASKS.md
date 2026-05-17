# Implementation Tasks: Wave 10 — Extensibility (MCP federation + GitHub embedded data)

Order matters. Each task references actual file paths. Verify each phase compiles + the relevant audit passes before starting the next.

**Estimated 13-15 working days.** Phasing optimized for landing MCP federation first (lower risk, smaller surface) then GitHub embedded data, then UI polish.

---

## Phase 0: Scope confirmation + spike (Day 1)

- [ ] Re-read this TASKS.md + PRD.md end to end. Confirm the 7 Open Questions in PRD.md are resolved or that the default position is acceptable.
- [ ] Spike: pick one reference MCP server to test federation against. Recommend `@modelcontextprotocol/server-everything` (official MCP-EVERYTHING example, npm `@modelcontextprotocol/server-everything`). Run it locally on a separate port to validate the federation roundtrip.
- [ ] Verify `SECRETS_ENCRYPTION_KEY` env var slot is unset in Dokploy prod env (we add it in Phase 1). Generate a 32-byte key locally via `openssl rand -hex 32`.

## Phase 1: Schema + secrets service (Days 2-3)

- [ ] Add 4 new enums + 1 enum extension to `apps/web/prisma/schema.prisma`: `McpServerTransport`, `McpServerAuthType`, `ExternalDataProvider`, `ExternalDataAuthType`, plus `EXTERNAL_DATABASE` in `ContextEntryType`.
- [ ] Add 3 new models to `apps/web/prisma/schema.prisma`: `McpServerConnection`, `McpServerToolCache`, `ExternalDataSource`. Plus the `externalDataSourceId` nullable FK on `ContextEntry`.
- [ ] Hand-write migration `20260518000001_wave10_add_enums` adding the 4 enums + the `EXTERNAL_DATABASE` enum value.
- [ ] Hand-write migration `20260518000002_wave10_add_mcp_tables` creating `McpServerConnection` + `McpServerToolCache` + CHECK constraints (`octet_length("encryptedCredentials") <= 4096`, `octet_length("inputSchema"::text) <= 32768`) + indexes.
- [ ] Hand-write migration `20260518000003_wave10_add_external_data_source` creating `ExternalDataSource` + CHECK constraints (`octet_length("encryptedCredentials") <= 4096`, `octet_length("config"::text) <= 16384`) + indexes.
- [ ] Hand-write migration `20260518000004_wave10_link_context_entry_external` adding `ContextEntry.externalDataSourceId` (nullable FK, SetNull).
- [ ] Run `ax:migrate` for each migration. Delegate to `ascend-migration-auditor`. Verify `search_vector` untouched (DZ-2).
- [ ] Run `npx prisma generate` after applying.
- [ ] Add `SECRETS_ENCRYPTION_KEY` to `apps/web/.env.example` with comment "64 hex chars (32 bytes). Generate with: openssl rand -hex 32. MUST be distinct from AUTH_JWT_SECRET / CRDT_JWT_SECRET / CRDT_PERSIST_SECRET."
- [ ] Create `apps/web/lib/services/secrets-service.ts` exporting `encryptSecret(plaintext: string): string` (returns `iv.ciphertext.tag` base64-joined) and `decryptSecret(envelope: string): string`. AES-256-GCM. Use Node `crypto`. Module-load assert: `SECRETS_ENCRYPTION_KEY` set, exactly 64 hex chars, distinct from the 3 other secrets (extend the existing distinctness check in `workspace-context-service.ts` OR mirror the pattern in `secrets-service.ts`).
- [ ] Verify: round-trip `encrypt → decrypt` test in a one-off `pnpm exec tsx` script. Confirm tampering the ciphertext byte produces a GCM auth-tag failure.

## Phase 2: Zod schemas + shared types (Day 3)

- [ ] Add `packages/core/src/types/external-data.ts` with `ExternalDataField`, `ExternalDataShape`, `ExternalDataRow`, `ExternalDataFilter` types (mirroring Wave 5 field/filter types but with adapter-readable provenance).
- [ ] Add `packages/core/src/schemas/external-data.ts` with `createExternalSourceSchema`, `updateExternalSourceSchema`, `externalDataQuerySchema`, `externalDataConfigSchema` (per-provider discriminated union: GitHub variant has `scope`, `orgSlug?`, `repoFilter?`).
- [ ] Add `packages/core/src/schemas/mcp-federation.ts` with `createMcpConnectionSchema`, `updateMcpConnectionSchema`, `testMcpConnectionSchema`. Reuse the new `McpServerTransport` / `McpServerAuthType` Prisma enums (re-export as Zod enums from `@ascend/core`).
- [ ] Re-export from `apps/web/lib/validations.ts`.
- [ ] Verify `pnpm --filter @ascend/core build` passes. Verify `pnpm --filter @ascend/web exec tsc --noEmit` passes.

## Phase 3: MCP federation service + proxy (Days 4-5)

- [ ] Create `apps/web/lib/services/mcp-federation-service.ts`. Methods per PRD: `listConnections`, `getConnection`, `createConnection`, `updateConnection`, `deleteConnection`, `testConnection`, `refreshToolCache`. All userId+workspaceId-first. Permission gates via `permissionService` for writes. `getConnection` strips `encryptedCredentials` before returning to non-internal callers; internal `getConnectionWithSecret` returns the decrypted PAT.
- [ ] Create `apps/web/lib/mcp/federation-proxy.ts`. Exports `callTool(connection: McpServerConnectionWithSecret, toolName: string, args: unknown): Promise<McpResponse>`. Implements both `HTTP_STREAMABLE` (POST JSON-RPC) and `SSE` (POST initialize, then long-poll EventSource for the response). 30s timeout via `AbortController`. Maps upstream errors to MCP error envelope. Never throws.
- [ ] Unit-test the proxy against `@modelcontextprotocol/server-everything` running locally on a side port. Run a few `tools/call` happy-paths + 1 timeout case.

## Phase 4: MCP federation API routes + Ascend `/api/mcp` extension (Days 6-7)

- [ ] Create `apps/web/app/api/mcp-servers/route.ts` (GET + POST).
- [ ] Create `apps/web/app/api/mcp-servers/[id]/route.ts` (GET + PATCH + DELETE).
- [ ] Create `apps/web/app/api/mcp-servers/[id]/test/route.ts` (POST). Calls `mcpFederationService.testConnection` and on success calls `refreshToolCache`.
- [ ] Extend `apps/web/app/api/mcp/route.ts`:
  - In the `tools/list` handler, after assembling the 79 native tools, query `McpServerToolCache` rows for the authenticating user+workspace where the parent connection has `enabled = true`. Append each as `<connection.slug>__<tool.toolName>`.
  - In the `tools/call` handler, BEFORE the existing switch on tool name, check if `params.name.includes("__")`. If yes, split on the FIRST `__`, look up the connection by slug, delegate to `federationProxy.callTool`. If the connection doesn't exist or is disabled, return MCP error -32601 ("Method not found").
- [ ] Run `ax:review` on the extended route. Delegate to `ascend-reviewer` + `ascend-security`. Verify: no native tool is bypassed by the federation check (split must NOT misinterpret legitimate native tool names containing `__`); `__` (double underscore) is not used by any of the 79 native tools (grep + assert).

## Phase 5: MCP federation React Query hooks + UI (Days 8-9)

- [ ] Add `mcpServers.*` keys to `apps/web/lib/queries/keys.ts`: `mcpServers.all()`, `mcpServers.list()`, `mcpServers.detail(id)`, `mcpServers.tools(id)`.
- [ ] Add `apps/web/lib/hooks/use-mcp-servers.ts`. Hooks: `useMcpServers`, `useMcpServer(id)`, `useCreateMcpServer`, `useUpdateMcpServer`, `useDeleteMcpServer`, `useTestMcpServer`. Cache invalidation per PRD table.
- [ ] Check `.claude/COMPONENT_CATALOG.md` for any existing settings list component to mimic.
- [ ] Create `apps/web/components/settings/mcp-server-list.tsx` rendering a `<Table>` of connections.
- [ ] Create `apps/web/components/settings/mcp-server-form-dialog.tsx` with shadcn `Dialog` + form. Auto-derives `slug` from `name` (lowercase, hyphenate, dedupe number suffix on conflict). Credentials field is `<Input type="password" />` with a "Reveal" toggle. PATCH path: empty credentials field leaves existing ciphertext.
- [ ] Create `apps/web/components/settings/mcp-server-test-button.tsx` that shows the test-button + last-status pill (Healthy: green dot + tool count; Error: amber dot + truncated message; Never tested: gray dot).
- [ ] Create the page at `apps/web/app/(app)/settings/mcp-servers/page.tsx` mounting the list + form dialog.
- [ ] Add an "MCP Servers" sidebar nav item in `apps/web/app/(app)/settings/layout.tsx` (or wherever the settings nav lives).
- [ ] Run `ax:verify-ui` on the new page. Verify: list renders, + new dialog opens + submits, test button works against the local reference server.

## Phase 6: External data adapter + service (Days 10-11)

- [ ] Create `apps/web/lib/external-data/types.ts` with the `ExternalDataAdapter` interface.
- [ ] Create `apps/web/lib/external-data/adapters/github-adapter.ts`:
  - `listShapes()` returns `[{ id: "issues", label: "Issues" }, { id: "pulls", label: "Pull Requests" }, { id: "repos", label: "Repos" }]` (Repos is stretch).
  - `getSchema("issues")` returns the ExternalDataField[] mapping GitHub Issue fields to Wave 5 types per PRD.
  - `getSchema("pulls")` similar for PRs.
  - `query("issues", filter, { cursor, perPage = 25 })` calls `https://api.github.com/search/issues?q=...` (because that's the only endpoint that supports cross-repo filtering); fall back to `repos/{owner}/{repo}/issues` for single-repo filter cases. Parse `Link` header for cursor. Return `{ rows, nextCursor }`.
  - `query("pulls", ...)` similar.
  - `getRow("issues", "<remoteId>")` returns a single issue by node_id; uses GitHub's GraphQL API OR `/repos/.../issues/{number}` REST.
  - Rate-limit budget: read `X-RateLimit-Remaining` from every response. If < 5, return `{ rows: [], nextCursor: null, rateLimited: true }` with a sentinel error type the UI can render.
- [ ] Create `apps/web/lib/external-data/cache.ts` — process-local LRU keyed by `${userId}:${workspaceId}:${sourceId}:${shape}:${filterHash}:${page}`. Default 5-min TTL. Max 256 MiB total (configurable via `EXTERNAL_DATA_CACHE_MAX_MB`).
- [ ] Create `apps/web/lib/services/external-data-service.ts` per PRD. `createSource` runs a 2-step transaction: create `ExternalDataSource` then create `ContextEntry` of type `EXTERNAL_DATABASE` with the `externalDataSourceId` FK. `query` checks the cache → delegates to adapter on miss → caches the result.
- [ ] Run `ax:review` on the service. Delegate to `ascend-security` for the PAT-handling path. Verify: no PAT plaintext is ever logged; `getSource` for external callers omits `encryptedCredentials`.

## Phase 7: External data API routes (Day 12)

- [ ] Create `apps/web/app/api/external-data/sources/route.ts` (GET + POST).
- [ ] Create `apps/web/app/api/external-data/sources/[id]/route.ts` (GET + PATCH + DELETE).
- [ ] Create `apps/web/app/api/external-data/sources/[id]/refresh-schema/route.ts` (POST).
- [ ] Create `apps/web/app/api/external-data/sources/[id]/query/route.ts` (POST). Body Zod-validated via `externalDataQuerySchema`. Returns `{ rows, nextCursor, totalCount? }`.
- [ ] Run `ax:review` on the 4 routes. Delegate to `ascend-security` for the PAT auth + workspace scoping. Verify: every Prisma query in the touched services includes `userId AND workspaceId`.

## Phase 8: External data React Query hooks + UI (Days 13-14)

- [ ] Add `externalData.*` keys to `apps/web/lib/queries/keys.ts`.
- [ ] Add `apps/web/lib/hooks/use-external-data.ts`. Hooks: `useExternalSources`, `useExternalSource(id)`, `useCreateExternalSource`, `useUpdateExternalSource`, `useDeleteExternalSource`, `useRefreshExternalSchema`, `useExternalDataRows(sourceId, shape, filter, sort, cursor)`. Cache invalidation per PRD.
- [ ] Create `apps/web/components/settings/external-source-list.tsx`.
- [ ] Create `apps/web/components/settings/external-source-form-dialog.tsx` with provider picker (only GitHub in W10), PAT paste, scope picker. Includes "Required scopes: repo, read:user, read:org" instruction.
- [ ] Create `apps/web/app/(app)/settings/integrations/page.tsx`.
- [ ] Create `apps/web/components/databases/external-database-detail.tsx` mounted from `database-detail.tsx` when `entry.type === "EXTERNAL_DATABASE"`. Renders a Table/Board view switcher.
- [ ] Create `apps/web/components/databases/external-table-view.tsx` — a thinner variant of Wave 5's `table-view/` reading from `useExternalDataRows`. Read-only cells. Filter + sort via the existing Wave 5 `view-config-popover` bound to the schema cached in `ExternalDataSource.config.shapeSchemas[shape]`. "Load more" footer button (no infinite scroll).
- [ ] Create `apps/web/components/databases/external-board-view.tsx` — group by SELECT field (default: State for issues/pulls).
- [ ] Create `apps/web/components/databases/external-row-detail.tsx` for the row Sheet (read-only fields + "Linked notes" backlinks section).
- [ ] Extend `packages/core/src/wikilink.ts` parser to recognize `gh-issue-<id>`, `gh-pr-<id>` patterns and emit virtual entry IDs of the form `ext:<sourceId>:<shape>:<remoteId>`. Resolution at render time happens in a new helper in `apps/web/lib/external-data/wikilink-resolver.ts`.
- [ ] Wire the `/context` list view + search to include EXTERNAL_DATABASE entries (text-only; no semantic embedding).
- [ ] Run `ax:verify-ui`. Verify: add a GitHub source with a valid PAT, see the database appear in /context, table renders issues with correct field types, board groups by state, filter for `state=open` works, refresh-schema button updates the labels list.

## Phase 9: MCP tools (round 10) (Day 14)

- [ ] Add 7 tool definitions to `apps/web/lib/mcp/schemas.ts`: `list_mcp_connections`, `test_mcp_connection`, `enable_mcp_connection`, `disable_mcp_connection`, `list_external_sources`, `query_external_data`, `refresh_external_schema`. All with full JSON Schema.
- [ ] Create `apps/web/lib/mcp/tools/mcp-federation-tools.ts` handler for the 4 mcp-federation tools.
- [ ] Create `apps/web/lib/mcp/tools/external-data-tools.ts` handler for the 3 external-data tools.
- [ ] Register both Sets in `apps/web/lib/mcp/server.ts`: `MCP_FEDERATION_TOOL_NAMES`, `EXTERNAL_DATA_TOOL_NAMES`. Add dispatch branches.
- [ ] Update the Architecture section of CLAUDE.md to reflect tool count 79 → 86 + 1 new MCP federation surface.

## Phase 10: Activity events + delight (Day 14)

- [ ] Add 4 new `ActivityEventType` enum values via migration `20260518000005_wave10_activity_events`: `MCP_SERVER_CONNECTED`, `MCP_SERVER_DISCONNECTED`, `EXTERNAL_SOURCE_CONNECTED`, `EXTERNAL_SOURCE_DISCONNECTED`.
- [ ] Wire `activityEventService` calls from `mcpFederationService.createConnection / deleteConnection` and `externalDataService.createSource / deleteSource`.
- [ ] Extend `apps/web/components/activity/activity-feed-view.tsx` filter sidebar with a new "Integrations" group containing the 4 new event types.
- [ ] Add confetti on `useCreateMcpServer.onSuccess` and `useCreateExternalSource.onSuccess` via `apps/web/lib/confetti.ts`. Reduced-motion aware.

## Phase 11: Verification (Day 15)

- [ ] Run `npx tsc --noEmit` — zero errors.
- [ ] Run `pnpm --filter @ascend/web build` — zero errors.
- [ ] Run `ax:review` — safety rule + pattern compliance. Verify: every Prisma query in 3 new services includes `userId AND workspaceId`; every POST/PUT/PATCH route parses through Zod; every mutation hook invalidates the correct keys.
- [ ] Run `ax:verify-ui` end to end: add MCP server connection, test it, see federated tools appear in the MCP `tools/list` response (curl `/api/mcp` with the api key + a JSON-RPC `tools/list`). Add GitHub source, browse issues table, filter, board view, wikilink resolution, delete source.
- [ ] Run `ax:critique`. Target: GOOD or WORLD-CLASS.
- [ ] Add DZ-28 + DZ-29 + Wave 10 section to CLAUDE.md.
- [ ] Update `COMPONENT_CATALOG.md` with the new components.
- [ ] Update `.ascendflow/BACKLOG.md` — mark Wave 10 SHIPPED with the actual scope, list carry-overs for Wave 10b (custom views, plugin API, Linear / Slack / Notion adapters, GitHub Discussions / Releases / Projects, OAuth, write-back).
- [ ] Write `.ascendflow/features/context-v2/wave-10-extensibility/CLOSE-OUT.md` per the Wave 9 close-out structure. Include per-criterion audit + manual smoke checklist + production deploys.
- [ ] Run `ax:wave-close 10`.
- [ ] Run `ax:deploy-check`. Push to main. Confirm Dokploy deploy lands.
- [ ] Manual smoke on prod: PAT entry, Issues table loads, federated tool roundtrip via Claude or local MCP client.

---

## Notes

- **MCP federation lands before GitHub.** Federation has fewer moving parts (no UI table view machinery, no adapter abstraction) and validates the core "credentials at rest + proxy roundtrip" infra that GitHub also depends on.
- **GitHub Issues + PRs ship together.** Both are issue-shaped; the adapter abstraction supports both for the same code cost. Repos browse is stretch in Phase 8; cut if Phase 8 runs long.
- **The `__` prefix delimiter** must be checked against the 79 existing native tool names in Phase 4 before extending `tools/list`. If any native tool's name contains `__`, change the delimiter to `.` or similar.
- **AES-256-GCM** chosen over AES-256-CBC because GCM has authenticated encryption built-in (no separate HMAC). Each ciphertext gets a fresh 12-byte IV. The 16-byte auth tag is appended.
- **GitHub PAT scope** — "repo, read:user, read:org" is the minimum needed for cross-repo Issues + PRs + Repos browse. Reduce to "public_repo, read:user" if user toggles "Public repos only" in the form (deferred to Wave 10b).
- **No background polling in W10.** Adding a cron worker increases infra surface. The 5-min cache + manual "Refresh" button is enough for read-heavy use cases.
- **No webhooks in W10.** Public webhook endpoint + secret validation + replay protection is its own multi-week feature.
- **Wave 8b membership-aware MCP connection sharing** — deferred. Each user's MCP connections + external sources are private even within a shared workspace.
