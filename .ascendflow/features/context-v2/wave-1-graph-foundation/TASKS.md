# Implementation Tasks: Wave 1 — Graph Foundation

**Parent:** [PRD.md](./PRD.md) · [VISION.md](../VISION.md)
**Sizing:** 15 working days solo. Prerequisite: Wave 0 closed.
**All implementation delegated to `ascend-dev`. UI polish to `ascend-ux`. Verification at the end of every phase.**

---

## Phase 1: Schema, enums, migration (Days 1–2)

- [ ] **1.1 Edit `apps/web/prisma/schema.prisma`:**
  - Add `ContextEntryType` enum (NOTE, SOURCE, PROJECT, PERSON, DECISION, QUESTION, AREA).
  - Add `ContextLinkType` enum (REFERENCES, EXTENDS, CONTRADICTS, SUPPORTS, EXAMPLE_OF, DERIVED_FROM, SUPERSEDES, APPLIES_TO, PART_OF).
  - Add `ContextLinkSource` enum (CONTENT, MANUAL).
  - Add `type ContextEntryType @default(NOTE)` to `ContextEntry`.
  - Add `ContextLink` model per PRD schema (with denormalized `userId`, composite unique, indexes).
  - Add relations `outgoingLinks` / `incomingLinks` on `ContextEntry`.
  - Keep `linkedEntryIds` array for now (to be removed in Phase 8).
- [ ] **1.2 Run `pnpm --filter @ascend/web exec prisma migrate dev --name wave1_graph_foundation`.**
- [ ] **1.3 Inspect generated SQL:** confirm `CREATE TABLE "ContextLink"`, `ALTER TABLE "ContextEntry" ADD COLUMN "type"`, no DROP on `search_vector`.
- [ ] **1.4 Write data backfill migration:** create `apps/web/prisma/migrations/<hash>_wave1_backfill_links/migration.sql` (manual SQL file, added BEFORE running `migrate dev` again):
  ```sql
  INSERT INTO "ContextLink" (id, "userId", "fromEntryId", "toEntryId", type, source, "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    e."userId",
    e.id,
    linked_id,
    'REFERENCES',
    'CONTENT',
    now(),
    now()
  FROM "ContextEntry" e,
       unnest(e."linkedEntryIds") AS linked_id
  WHERE linked_id IN (SELECT id FROM "ContextEntry")
  ON CONFLICT ("fromEntryId", "toEntryId", type) DO NOTHING;
  ```
- [ ] **1.5 Apply backfill** with `pnpm --filter @ascend/web exec prisma migrate dev`.
- [ ] **1.6 Verify:** `SELECT count(*) FROM "ContextLink"` equals sum of array lengths from `linkedEntryIds`. Confirm `search_vector` column still exists. Sample 5 entries, compare their old linked IDs to new `ContextLink` rows.
- [ ] **1.7 Commit**: `feat(db): add ContextLink typed edges, ContextEntry type, backfill from linkedEntryIds`.

Verification: `pnpm typecheck` green.

---

## Phase 2: Shared logic — graph layout + wikilink parser (Days 3–4)

### packages/graph

- [ ] **2.1 Create `packages/graph/`:** `package.json` (name `@ascend/graph`), `src/layout.ts`, `src/types.ts`.
- [ ] **2.2 Install `d3-force`** in the package.
- [ ] **2.3 Implement pure `computeLayout({ nodes, edges, options }) → Array<{id, x, y}>`:**
  - Accepts platform-agnostic `GraphNode` and `GraphEdge` types (exported from `@ascend/graph`).
  - Runs d3-force simulation to steady state OR returns simulation object for interactive update.
  - No DOM access. No React. Works in Node, browser, and React Native.
- [ ] **2.4 Export coloring helpers:** `edgeColor(type)`, `nodeColor(entryType)` returning hex from `@ascend/ui-tokens`.
- [ ] **2.5 Unit test `computeLayout`:** seed 10, 100, 500 node graphs; assert positions bounded, edges connect positioned nodes, no NaN.

### @ascend/core additions

- [ ] **2.6 Add `ContextEntryType` and `ContextLinkType`** enum constants + Zod schemas to `packages/core/src/constants/context-types.ts` and `packages/core/src/schemas/context-schemas.ts`. Re-export from `apps/web/lib/validations.ts`.
- [ ] **2.7 Write extended wikilink parser** in `packages/core/src/wikilink.ts`:
  - Input: raw content string.
  - Output: `Array<{ relation: ContextLinkType; title: string; raw: string; start: number; end: number }>`.
  - Regex capturing `[[Title]]` (defaults REFERENCES) and `[[relation:Title]]`.
  - Case-insensitive relation matching. Unknown relation → REFERENCES with a warning in dev (console.warn).
  - Handles escaped `\[\[` as literal (doesn't match).
- [ ] **2.8 Unit test parser:** cover 20 cases (simple, typed, spaces in title, case variation, unknown relation, escaped, mixed content, markdown code block skip, empty content).
- [ ] **2.9 Commit**: `feat(graph,core): platform-agnostic graph layout + typed wikilink parser`.

---

## Phase 3: Service layer (Days 5–6)

- [ ] **3.1 Create `apps/web/lib/services/context-link-service.ts`:**
  - `list(userId, { fromEntryId?, toEntryId? })` → filtered rows with both ends joined.
  - `listForEntry(userId, entryId)` → outgoing + incoming split.
  - `create(userId, { fromEntryId, toEntryId, type, source })` → verifies both entries belong to user; upserts on the composite unique; returns row. Manual links default `source: MANUAL`.
  - `update(userId, id, { type })` → existence check, user scope, update type.
  - `delete(userId, id, options?)` → existence check; if source=CONTENT and !force, throw "edit content to remove"; else delete.
  - `syncContentLinks(userId, fromEntryId, parsedLinks)` → takes parser output, upserts CONTENT-source links to match, deletes stale CONTENT links, leaves MANUAL links alone. Transactional.
- [ ] **3.2 Extend `apps/web/lib/services/context-service.ts`:**
  - `updateType(userId, id, type)` — existence check + update + return.
  - `listByType(userId, type)` — filter.
  - `getGraph(userId, filters)` — returns `{ nodes, edges }` shape from PRD. Applies filters (types, categoryId, tag). Caps at 1000 nodes by degree.
  - `getNeighbors(userId, id, depth)` — BFS up to depth, returns nodes + edges.
  - `getRelated(userId, id)` — implements weighting heuristic: direct edges 1.0, 2-hop 0.5, shared tag 0.3, same category 0.2. Top 20.
  - Rewrite existing `create` and `update`: after content write, call parser (from `@ascend/core`), then `contextLinkService.syncContentLinks`. Remove the old `parseBacklinks` method and the `linkedEntryIds` write path.
  - Extend `list` / `getById` responses to include `type` field. `getById` now joins `ContextLink` into `outgoingLinks` / `incomingLinks` groups.
- [ ] **3.3 Safety audit:** every new and modified method includes `userId` in every Prisma where clause; every new query that touches `ContextLink` also filters by `userId` (denormalized). No exceptions.
- [ ] **3.4 Commit**: `feat(services): contextLinkService + graph methods on contextService`.

---

## Phase 4: API routes (Days 6–7)

Follow `api-route-patterns.md` rigidly: authenticate → parse with Zod → call service → respond via `NextResponse.json` / handle via `handleApiError`.

- [ ] **4.1 Add Zod schemas to `@ascend/core`:**
  - `createContextLinkSchema`, `updateContextLinkSchema`, `deleteContextLinkSchema` (optional `force` boolean).
  - `contextGraphFiltersSchema` (types?, categoryId?, tag?, cap? default 1000).
- [ ] **4.2 Create `apps/web/app/api/context-links/route.ts`:** POST → `contextLinkService.create`; GET → list for user (rarely used externally, mostly for MCP).
- [ ] **4.3 Create `apps/web/app/api/context-links/[id]/route.ts`:** PATCH → update type; DELETE → delete with optional `force` query param.
- [ ] **4.4 Create `apps/web/app/api/context/graph/route.ts`:** GET, parses filters, calls `contextService.getGraph`, returns `{ nodes, edges }`.
- [ ] **4.5 Create `apps/web/app/api/context/[id]/neighbors/route.ts`:** GET with `?depth=N` default 1, max 3. Calls `contextService.getNeighbors`.
- [ ] **4.6 Create `apps/web/app/api/context/[id]/related/route.ts`:** GET. Calls `contextService.getRelated`.
- [ ] **4.7 Extend existing `apps/web/app/api/context/[id]/route.ts` PATCH** to accept `type` in body (already covered by extending `updateContextSchema` in core).
- [ ] **4.8 Verify all 6 new routes** end with `handleApiError` in catch, return 201 on creation, 404 on not found.
- [ ] **4.9 Commit**: `feat(api): graph and typed-link endpoints`.

---

## Phase 5: React Query hooks + cache keys (Day 8)

- [ ] **5.1 Update `apps/web/lib/queries/keys.ts`:** add `context.graph`, `context.neighbors`, `context.related`, `context.byType`, `context.links.forEntry`, `context.links.all`. Composable with existing keys.
- [ ] **5.2 Extend `apps/web/lib/hooks/use-context.ts`:**
  - `useContextGraph(filters?)` — `useQuery`.
  - `useNodeNeighbors(id, depth)` — `useQuery`, only when `id` defined.
  - `useRelatedContext(id)` — `useQuery`.
  - `useCreateContextLink()` — `useMutation`; onSuccess invalidates `context.graph`, `byId(fromEntryId)`, `byId(toEntryId)`, `links.forEntry(from)`, `links.forEntry(to)`, `neighbors(from)`, `neighbors(to)`.
  - `useUpdateContextLink()` — same invalidations.
  - `useDeleteContextLink()` — same invalidations.
  - `useUpdateContextType()` — onSuccess invalidates `all`, `byId(id)`, `graph`, `byType(oldType)`, `byType(newType)`.
- [ ] **5.3 All hooks use `api` client from `apps/web/lib/api-client.ts`**. No direct `fetch`.
- [ ] **5.4 Commit**: `feat(hooks): graph + typed-link React Query hooks`.

---

## Phase 6: UI components (Days 9–12)

### View switcher

- [ ] **6.1 Update `apps/web/lib/stores/ui-store.ts`:** `activeView` for context now `"list" | "graph" | "pinned" | "backlinks"`. Bump store version to force migration; default `"list"`.
- [ ] **6.2 Create `apps/web/components/context/context-view-switcher.tsx`** mirroring `goal-view-switcher.tsx` pattern. 4 buttons, icons, active state from Zustand.
- [ ] **6.3 Mount switcher** in `apps/web/app/(app)/context/page.tsx` above the filter bar.

### Graph view

- [ ] **6.4 Install `reactflow` in `apps/web`:** `pnpm --filter @ascend/web add reactflow`.
- [ ] **6.5 Create `apps/web/components/context/context-graph-view.tsx`:**
  - Consumes `useContextGraph(filters)`.
  - Runs `computeLayout` from `@ascend/graph` to get initial positions.
  - Renders `<ReactFlow>` with custom node component + edge type palette.
  - Minimap + controls (zoom + fit).
  - On node click: `useUIStore.setSelectedContextEntryId(id)`.
  - On node double-click: enters focus mode — hide nodes not in 2-hop neighborhood via opacity.
  - Filter chip bar above canvas: toggle edge types, filter by node type.
- [ ] **6.6 Create `apps/web/components/context/context-graph-node.tsx`:** custom ReactFlow node. Shows icon by type, title, pin badge, link-count badge.
- [ ] **6.7 Wire graph view into the page** behind the `"graph"` activeView.

### Detail panel — Edges section

- [ ] **6.8 Create `apps/web/components/context/context-edges-panel.tsx`:**
  - Takes an entry ID.
  - Consumes `useContextEntry(id)` (already returns `outgoingLinks` / `incomingLinks` after Phase 3).
  - Groups by edge type, shows counts.
  - Each row: target title + type dropdown (uses `useUpdateContextLink`) + delete button (uses `useDeleteContextLink`; disabled for CONTENT source with tooltip).
  - Quick Link button opens a `<ContextQuickLinkDialog>`.
- [ ] **6.9 Create `apps/web/components/context/context-quick-link-dialog.tsx`:** shadcn `Dialog`. Search entries by title; pick relation type; pick target; confirm → `useCreateContextLink` with `source: MANUAL`.
- [ ] **6.10 Integrate** into `context-entry-detail.tsx` below the existing metadata section.

### Entry type selector

- [ ] **6.11 Create `apps/web/components/context/context-type-select.tsx`:** dropdown with 7 options, color + icon per type, uses `useUpdateContextType`.
- [ ] **6.12 Mount in detail panel header.**
- [ ] **6.13 Surface type pill in `context-entry-list.tsx`** row.

### Pinned + Backlinks views

- [ ] **6.14 Pinned view:** thin wrapper on existing list filtered by `isPinned`. Already in list's "Pinned" section; now gets its own dedicated view.
- [ ] **6.15 Backlinks view:** list all entries, sorted by incoming-link count descending; each row shows link count + expand to see which entries link to it. Useful for finding "hub" entries.

### UX polish pass (end of Phase 6)

- [ ] **6.16 Delegate to `ascend-ux`** to audit: graph view color contrast, edge readability, detail panel edges section alignment with existing detail panels (use `goal-detail.tsx` patterns), empty states (graph with zero edges shows an illustration), loading states (skeleton for graph load).

---

## Phase 7: MCP tools round 1 (Day 13)

Follow `mcp-tool-patterns.md`: JSON Schema in `schemas.ts`, handler with Zod runtime validation, add to Set in `server.ts`.

- [ ] **7.1 Add JSON Schema definitions** to `apps/web/lib/mcp/schemas.ts` for:
  - `get_context_graph` ({ types?, categoryId?, tag?, cap? })
  - `get_node_neighbors` ({ id, depth? })
  - `get_related_context` ({ id })
  - `list_nodes_by_type` ({ type })
  - `create_typed_link` ({ fromEntryId, toEntryId, type })
  - `remove_typed_link` ({ id, force? })
  - `update_context_type` ({ id, type })
- [ ] **7.2 Extend `apps/web/lib/mcp/tools/context-tools.ts`** with handlers for the 7 new tools. Zod validate inside handler. Call `contextService` or `contextLinkService`.
- [ ] **7.3 Add tool names to an MCP Set** in `apps/web/lib/mcp/server.ts`:
  ```ts
  const GRAPH_TOOL_NAMES = new Set([
    "get_context_graph", "get_node_neighbors", "get_related_context",
    "list_nodes_by_type", "create_typed_link", "remove_typed_link",
    "update_context_type",
  ]);
  ```
  Add routing branch to dispatch to handler.
- [ ] **7.4 Update `get_context`, `set_context`, `list_context`** return shape to include `type` field (existing tools). Update their JSON Schema `output` documentation too.
- [ ] **7.5 MCP smoke test:** via `curl` with API key, call each of the 7 new tools. Confirm shapes match declared schemas. Confirm `list_context` now returns `type` on each row.
- [ ] **7.6 Commit**: `feat(mcp): graph-aware context tools round 1`.

---

## Phase 8: Cleanup + full verification (Days 14–15)

- [ ] **8.1 Remove `linkedEntryIds` write path** from `contextService.create` and `contextService.update` (already removed in Phase 3, verify no lingering writes via Grep).
- [ ] **8.2 Write finalize migration** `wave1_finalize_remove_linkedEntryIds`:
  - Verify every entry's old `linkedEntryIds[]` is represented in `ContextLink` (script).
  - If verified, `ALTER TABLE "ContextEntry" DROP COLUMN "linkedEntryIds"`.
  - Do NOT run against prod if verification fails — investigate first.
- [ ] **8.3 Regenerate Prisma client**; remove the field from `schema.prisma`; run `prisma generate`.
- [ ] **8.4 Grep `linkedEntryIds`** across the repo — zero matches expected.
- [ ] **8.5 `pnpm typecheck` + `pnpm build`** green.
- [ ] **8.6 Run `/ax:test`** (tsc + build).
- [ ] **8.7 Run `/ax:review`** — zero safety rule violations, zero pattern violations.
- [ ] **8.8 Run `/ax:verify-ui`:**
  - Graph view: loads, renders nodes with correct colors, edges colored by type, click opens detail, double-click enters focus mode, filter chips filter correctly.
  - Detail panel: edges section visible; can add manual link via Quick Link; can change type inline; can remove manual link; CONTENT link shows disabled delete with tooltip; type change reflects in list/graph immediately.
  - Editor: type `[[contradicts:Existing Title]]` → save → new row in edges panel with type CONTRADICTS.
  - List/Pinned/Backlinks views still function.
  - Reload page — view selection persists (Zustand).
- [ ] **8.9 Performance:** seed 500-entry fixture; measure time-to-first-render of graph view; target <2s cold, <200ms warm.
- [ ] **8.10 MCP final smoke:** call each of the 7 new tools; call 5 pre-existing context tools; confirm no regressions.
- [ ] **8.11 Update docs:**
  - `apps/web/CLAUDE.md` or root `CLAUDE.md`: update MCP tool count from 37 → 44.
  - Add graph view note under Views table.
  - Update entity model with `ContextLink`.
  - Add danger zone note: "`ContextLink.userId` is denormalized — always filter by userId."
- [ ] **8.12 Update `.ascendflow/BACKLOG.md`:** add any deferred polish (e.g., persisted layouts, mobile graph) to the backlog.
- [ ] **8.13 Write `CLOSE-OUT.md`** at `.ascendflow/features/context-v2/wave-1-graph-foundation/CLOSE-OUT.md`: summarize what shipped, deliverables status (DONE / SKIPPED / NOT DONE), final size, deferred items, lessons.
- [ ] **8.14 Run `/ax:deploy-check`.**
- [ ] **8.15 Commit**: `chore(wave-1): close Wave 1 — graph foundation shipped`.
- [ ] **8.16 Present deliverables checklist to user.** Mark each PRD success criterion explicitly. If any are NOT DONE, the wave is "partially complete" and remaining work is enumerated.

---

## Post-Wave 1 handoff to Wave 2

Wave 2 (AI-native MCP round 1) starts immediately on close. It assumes:
- `ContextLink` live with typed edges; unique constraint enforced; userId denormalized.
- `/api/context/graph`, `/neighbors`, `/related` working.
- MCP graph tools exposed to connected agents.
- Wikilink parser shared in `@ascend/core`.
- Graph view usable at 500+ nodes.

Wave 2 brings OpenAI integration, pgvector embeddings on every entry, MCP tools for retrieval-augmented conversation (`ask_context`, `find_similar`, `suggest_links`), and the LLMProvider abstraction ready for Anthropic in W3.
