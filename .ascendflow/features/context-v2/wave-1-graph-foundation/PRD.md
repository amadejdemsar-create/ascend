# Wave 1: Graph Foundation

**Slug:** `context-v2` / `wave-1-graph-foundation`
**Created:** 18. 4. 2026
**Status:** planning (blocked on Wave 0 close)
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md)
**Wave sizing:** ~3 weeks solo (target: 15 working days)

## Problem

Ascend's context system today treats entries as a flat list. Backlinks exist as an array of IDs on each entry (`ContextEntry.linkedEntryIds`) resolved via a regex `\[\[Title\]\]` parser. There are only two shapes of relation available: "linked" or "not linked." The system cannot express:

- **Entry types:** everything is a generic "entry." There is no distinction between a Note, a Source, a Project, a Person, or a Decision.
- **Typed relations:** there is no way to say "this note *contradicts* that one" or "this decision *supersedes* that one." Backlinks have no semantics.
- **Graph view:** users cannot see how their knowledge is connected. The mental model of a graph is the single most important conceptual unlock for a Zettelkasten-style system (Obsidian's core insight). Without a graph, we are a better Notes app, not a thinking tool.
- **Graph-aware AI:** Wave 2 needs to answer questions like "what's related to this entry?" or "what contradicts what I'm writing?" without typed edges, the LLM cannot do meaningful graph traversal — only string matching.

Wave 1 introduces the **graph as the primary data model**, with **typed semantic edges** and an **entry type system**, and surfaces it with a dedicated **graph view**. This turns Ascend's context section from a note list into a knowledge graph.

## User Story

As a thinker, I want to classify my context entries by type (note, source, project, person, decision), link them with meaningful relations (references, contradicts, supersedes, supports, example-of), and visualize the graph of my thinking — so that I and any connected AI can navigate knowledge the way it actually connects, not as a flat list.

## Success Criteria

Functional:
- [ ] Every `ContextEntry` has a `type` field: NOTE (default), SOURCE, PROJECT, PERSON, DECISION, QUESTION, AREA.
- [ ] A new `ContextLink` table persists typed edges between entries. Edge types: REFERENCES, EXTENDS, CONTRADICTS, SUPPORTS, EXAMPLE_OF, DERIVED_FROM, SUPERSEDES, APPLIES_TO, PART_OF.
- [ ] Wikilink syntax extended: `[[Title]]` still works (defaults to REFERENCES); `[[contradicts:Title]]`, `[[supports:Title]]`, etc. create typed edges on save.
- [ ] Detail panel shows incoming and outgoing edges, grouped by relation type, with edge counts.
- [ ] User can change the relation type of an existing edge from the detail panel (dropdown on the link row).
- [ ] User can add an edge manually from the detail panel without editing content (quick-link button).
- [ ] A new **Graph** view on `/context` renders the entry graph with ReactFlow + d3-force layout. Nodes colored by entry type; edges colored/labeled by relation type.
- [ ] Clicking a node in the graph opens its detail panel. Double-click enters focus mode (show only 2-hop neighborhood of that node).
- [ ] View switcher between List, Graph, Backlinks, Pinned is wired to `useUIStore.activeView` (`"list"` | `"graph"` | `"backlinks"` | `"pinned"`).
- [ ] Existing `linkedEntryIds` data is migrated: each existing link becomes a `ContextLink` row with type `REFERENCES`. Zero data loss.
- [ ] MCP tools round 1 (graph-aware): `get_context_graph`, `get_node_neighbors`, `get_related_context`, `list_nodes_by_type`, `create_typed_link`, `remove_typed_link`, `update_context_type`.
- [ ] Existing context MCP tools (`set_context`, `get_context`, `list_context`, `search_context`, `delete_context`) continue to work and now return the `type` field.

Quality:
- [ ] Graph renders smoothly with 500 nodes on mid-tier laptop (<16ms per frame once layout settles).
- [ ] Search and list performance for <2k entries unchanged.
- [ ] All existing `ax:verify-ui` scenarios for context pass.
- [ ] `npx tsc --noEmit` + `pnpm build` pass.
- [ ] `ax:review` full pass with zero safety rule violations.

Cross-platform readiness:
- [ ] Graph layout uses `d3-force` which is platform-agnostic. The renderer (`ReactFlow`) is web-only; the code is structured so the native renderer (W6, `react-native-skia`) can be swapped in without touching layout code. Layout lives in `packages/graph/`.
- [ ] No blockers introduced for W6 (mobile) or W9 (desktop).

## Affected Layers

- **Prisma schema**: add `ContextEntryType` enum, `ContextEntry.type` field, new `ContextLink` model, new `ContextLinkType` enum. Backfill migration converts existing `linkedEntryIds` to rows.
- **Service layer**:
  - `contextService` extended: `getGraph(userId, filters)`, `getNodeNeighbors(userId, id, depth)`, `getRelated(userId, id)`, `listByType(userId, type)`, `updateType(userId, id, type)`, `parseBacklinks` rewritten to return typed edges.
  - New `contextLinkService`: `create`, `update`, `delete`, `listForEntry`, `listForUser`.
- **API routes**:
  - `GET /api/context/graph` — returns nodes + edges.
  - `GET /api/context/:id/neighbors?depth=N` — returns N-hop neighborhood.
  - `GET /api/context/:id/related` — heuristic "related" (combines typed edges + tag overlap + textual similarity).
  - `POST /api/context-links` / `PATCH /api/context-links/:id` / `DELETE /api/context-links/:id`.
  - `PATCH /api/context/:id` — accepts new `type` field.
- **React Query hooks**: `lib/hooks/use-context.ts` extended with `useContextGraph`, `useNodeNeighbors`, `useRelatedContext`, `useCreateLink`, `useUpdateLink`, `useDeleteLink`, `useUpdateContextType`.
- **UI components**:
  - New: `components/context/context-graph-view.tsx` (ReactFlow canvas), `components/context/context-graph-node.tsx`, `components/context/context-graph-edge.tsx`, `components/context/context-type-select.tsx`, `components/context/context-edges-panel.tsx` (shown in detail panel), `components/context/context-quick-link-button.tsx`.
  - Modified: `components/context/context-entry-detail.tsx` (add Edges panel), `components/context/context-entry-editor.tsx` (extended wikilink parser), `components/context/context-entry-list.tsx` (show type pill), `components/layout/` (view switcher).
- **MCP tools**:
  - New: `get_context_graph`, `get_node_neighbors`, `get_related_context`, `list_nodes_by_type`, `create_typed_link`, `remove_typed_link`, `update_context_type`.
  - Modified: existing context tools return `type` field.
- **Zustand store**: `useUIStore.activeView` accepts `"graph"`, `"backlinks"`, `"pinned"`. Add `contextGraphFocusNodeId` + `contextGraphDepth`.
- **Shared packages**:
  - `@ascend/core`: add `ContextEntryType`, `ContextLinkType` enums; `contextLinkSchemas`; extended wikilink parser as pure function.
  - New `packages/graph/` (platform-agnostic): `computeLayout(nodes, edges, options)` using `d3-force`. Renderer-agnostic output (positions). Web renderer stays in `apps/web`.

## Data Model Changes

```prisma
enum ContextEntryType {
  NOTE       // default, generic thought
  SOURCE     // external reference: article, book, podcast
  PROJECT    // a discrete effort with scope
  PERSON     // a person or stakeholder
  DECISION   // a recorded decision with rationale
  QUESTION   // an open question or research thread
  AREA       // a long-lived domain (no end date)
}

enum ContextLinkType {
  REFERENCES    // general reference (default, existing wikilink behavior)
  EXTENDS       // builds on
  CONTRADICTS   // opposes
  SUPPORTS      // evidence for
  EXAMPLE_OF    // instance of
  DERIVED_FROM  // source of
  SUPERSEDES    // replaces / deprecates
  APPLIES_TO    // scope (e.g., decision APPLIES_TO project)
  PART_OF       // compositional
}

model ContextEntry {
  // ... existing fields ...
  type        ContextEntryType @default(NOTE)

  outgoingLinks ContextLink[] @relation("FromEntry")
  incomingLinks ContextLink[] @relation("ToEntry")

  @@index([userId, type])
}

model ContextLink {
  id          String @id @default(cuid())
  userId      String                   // denormalized for multi-tenant isolation
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)

  fromEntryId String
  fromEntry   ContextEntry @relation("FromEntry", fields: [fromEntryId], references: [id], onDelete: Cascade)
  toEntryId   String
  toEntry     ContextEntry @relation("ToEntry", fields: [toEntryId], references: [id], onDelete: Cascade)

  type        ContextLinkType @default(REFERENCES)

  // Where the link came from (for auto-managing content-derived links vs manual)
  source      ContextLinkSource @default(CONTENT)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([fromEntryId, toEntryId, type])
  @@index([userId])
  @@index([toEntryId, type])
  @@index([fromEntryId, type])
}

enum ContextLinkSource {
  CONTENT   // parsed from wikilink in content — auto-managed
  MANUAL    // user added via Quick Link button — persists independently
}
```

**`linkedEntryIds[]` on `ContextEntry` is kept for one migration cycle** as a fallback read path, then removed in Wave 1 close-out. This avoids a destructive migration during active development.

**Important:** the `search_vector` tsvector column stays untouched. The migration must not run `db push` or `migrate reset`.

Migration name: `20260505_wave1_graph_foundation` (tentative).

## API Contract

### `GET /api/context/graph?types=NOTE,SOURCE&categoryId=abc&tag=xyz`

Returns the full graph scoped to the user's entries (with optional filters).

**Response shape (200):**
```jsonc
{
  "nodes": [
    {
      "id": "cxxxxx",
      "title": "How AAVE accrues fees",
      "type": "NOTE",
      "categoryId": "cxxx",
      "categoryColor": "#ef4444",
      "tags": ["crypto", "lending"],
      "isPinned": false,
      "updatedAt": "2026-04-18T10:12:34Z",
      "wordCount": 420,
      "linkCount": { "outgoing": 3, "incoming": 5 }
    }
    // ...
  ],
  "edges": [
    {
      "id": "clxxx",
      "from": "cxxx",
      "to": "cyyy",
      "type": "SUPPORTS",
      "source": "CONTENT"
    }
    // ...
  ]
}
```

### `GET /api/context/:id/neighbors?depth=2`

Returns the subgraph of N-hop neighbors around an entry.

### `GET /api/context/:id/related`

Heuristic related entries: combines direct edges (weight 1.0), 2-hop edges (0.5), tag overlap (0.3 per shared tag), same category (0.2). Returns sorted top 20.

### `POST /api/context-links`

**Body:**
```json
{ "fromEntryId": "...", "toEntryId": "...", "type": "SUPPORTS", "source": "MANUAL" }
```
**Returns 201**.

### `PATCH /api/context-links/:id`

**Body:** `{ "type": "EXTENDS" }` (only type can be updated).
**Returns 200**.

### `DELETE /api/context-links/:id`

Manual-source links can always be deleted. Content-source links return 400 ("edit the entry content to remove `[[…]]` first") unless `force: true` — rare, reserved for cleanup tools.

### `PATCH /api/context/:id`

Existing route; now also accepts `{ type: ContextEntryType }`.

## UI Flows

### View switcher
At the top of `/context`, four tabs: **List** · **Graph** · **Pinned** · **Backlinks**. Selecting a tab sets `useUIStore.activeView`. Pinned + Backlinks are lightweight filtered lists; Graph is the main new surface.

### Graph view
- ReactFlow canvas fills the viewport below the filter bar.
- Nodes rendered as custom React components showing: icon (by type), title (truncated), tag chip row, pin badge, and link-count badge.
- Edges drawn with ReactFlow bezier; color by type (REFERENCES gray, SUPPORTS green, CONTRADICTS red, EXTENDS blue, SUPERSEDES orange, DERIVED_FROM purple, etc.).
- Layout: force-directed via d3-force (charge + link + center). Initial layout runs once on data load; user can drag nodes; positions persist in memory only (v1 — persistence of layout to DB in Wave 2+).
- Filter chips above canvas: toggle edge types on/off, filter node types, focus on current category.
- Click node → detail panel opens (same panel used in List view).
- Double-click node → focus mode (only 2-hop subgraph remains visible, rest fades to 10% opacity).
- Hover node → highlight outgoing + incoming edges.
- Minimap in corner; zoom + pan standard.

### Detail panel
New **Edges** section below existing metadata, grouped: "Outgoing" · "Incoming." Each group lists by edge type with count. Each row shows target entry title + type dropdown (change relation inline) + remove button. Bottom: **Quick Link** button opens a small search picker to add a manual link of any type to any other entry.

### Extended wikilink parser
Editing an entry. User types `[[contradicts:Linear fee structure]]`. On blur (or autosave), content is parsed:
- `[[Title]]` → creates/updates `ContextLink` with type REFERENCES, source CONTENT.
- `[[relation:Title]]` → creates/updates `ContextLink` with matched type, source CONTENT.
- Removed wikilinks → corresponding CONTENT-source links are deleted.
- MANUAL-source links are never touched by content parsing.

### Entry type selector
In detail panel header, a pill showing entry type (color-coded icon). Click → dropdown of 7 types. Changing type re-renders node color in graph and filter pills.

## Cache Invalidation

After any mutation:

- `POST /context-links`, `PATCH /context-links/:id`, `DELETE /context-links/:id`:
  - Invalidate `queryKeys.context.graph`.
  - Invalidate `queryKeys.context.byId(fromEntryId)` and `byId(toEntryId)`.
  - Invalidate `queryKeys.context.neighbors(fromEntryId)` and `neighbors(toEntryId)`.
- `PATCH /context/:id` with `type` change:
  - Invalidate `queryKeys.context.all`, `byId(id)`, `graph`, `listByType(*)`.
- `PATCH /context/:id` with content change (existing):
  - Re-run `parseBacklinks` in the service, apply edge diffs, then invalidate as per "POST context-links" above for affected edges.
  - Invalidate `queryKeys.context.byId(id)`, `all`, `graph`.

New query keys added to `lib/queries/keys.ts`:
```ts
context: {
  // ... existing ...
  graph: (filters?) => [...context.all(), "graph", filters],
  neighbors: (id, depth) => [...context.all(), "neighbors", id, depth],
  related: (id) => [...context.all(), "related", id],
  byType: (type) => [...context.all(), "by-type", type],
  links: {
    all: () => [...context.all(), "links"],
    forEntry: (id) => [...context.all(), "links", id],
  }
}
```

## Danger Zones Touched

**`linkedEntryIds[]` dual-read during migration.** Old code reads from the array; new code reads from `ContextLink`. Mitigation: write to both during Wave 1 on any content save (service layer handles the sync); reads use `ContextLink` only from Phase 3 onward. Remove the array in Wave 1 close-out migration once verified.

**Full-text search preservation.** `search_vector` tsvector must not be dropped by the migration. Verified by the same query pattern as Wave 0 Phase 3 step 3.6.

**Cross-user edge isolation.** `ContextLink` has denormalized `userId`. Every service method must filter by `userId` in the where clause. This is the multi-tenant boundary (safety rule 1). No edge can cross user boundaries even if IDs are guessed.

**MCP tool count jumps from 37 to 44.** Not a real danger but worth logging: update docs that cite "37 MCP tools" including the README and `CLAUDE.md` architecture section.

**Graph performance at scale.** For power users with 5k+ entries, full graph load is too heavy. Mitigation in v1: the `/graph` endpoint accepts filters (category, tag, type) and defaults to a sane cap (1000 nodes + top-degree fill-in); documented limitation. Proper large-graph handling (virtualization, server-side layout) is Wave 5 work.

## Cross-Platform Readiness

- Graph layout lives in `packages/graph/` as a pure function: `computeLayout(nodes, edges, options) → nodePositions`. No React, no DOM, no React Native. It uses only `d3-force` which is pure TS/JS.
- Web renderer (ReactFlow) stays in `apps/web/components/context/context-graph-view.tsx`. On W6, `apps/mobile/` will implement the same view via `react-native-skia` consuming the same layout output.
- Typed edge enums live in `@ascend/core` — the mobile app renders the same colors and labels.
- Wikilink parser is a pure function in `@ascend/core/src/wikilink.ts` — shared between web editor (W1) and native editor (W6).

## Out of Scope

- **AI-suggested links** ("the LLM proposes connections you haven't made yet") — Wave 2.
- **Persisted graph layouts** (positions saved server-side) — Wave 5.
- **Canvas / spatial view** (Kosmik-style) — Wave 9.
- **Backlinks autocomplete UI in editor** (`[[` triggers a picker) — Wave 3 when block editor arrives.
- **Graph clustering / communities algorithm** — v2+.
- **3D graph view** — never (gimmick; not shipping).
- **Edge labels in content** (edges carrying free-form notes, e.g., "see chapter 4") — W5 ("rich edges").
- **Mobile graph view** — Wave 6.
- **Workspace sharing of the graph** — Wave 8.

## Open Questions

1. **Default entry type for backfill.** All existing entries become `NOTE`. Confirmed.
2. **`APPLIES_TO` semantics.** Does this need directionality clarification for users? Propose: "X applies to Y" means X (typically a decision) has scope Y. Iterate based on usage.
3. **Focus mode zoom behavior.** Auto-zoom to fit the 2-hop subgraph or keep current viewport? v1: auto-zoom with easing.
4. **Graph view filter chip interactions.** When user toggles "show CONTRADICTS only," what happens to nodes with no contradictions? v1: fade to 30% opacity instead of hiding.

## Verification Plan

- [ ] `npx tsc --noEmit` + `pnpm build` zero errors.
- [ ] Migration tested on a clone of prod DB; `search_vector` column survives; row counts for `ContextEntry` unchanged; every former `linkedEntryIds[]` entry produces one `ContextLink` row with type REFERENCES and source CONTENT.
- [ ] Unit test: wikilink parser — `[[Title]]` + `[[contradicts:Title]]` + `[[contradicts: Title With Spaces]]` + escaped content + plain text. Cover 10+ cases.
- [ ] `/ax:test` green.
- [ ] `/ax:review` green. Specifically:
  - every new service method includes `userId`.
  - every new API route calls `authenticate` first, parses with Zod, calls service, handles errors via `handleApiError`.
  - every new mutation invalidates the correct query keys per Cache Invalidation section.
  - `@/lib/db` not imported outside `apps/web/lib/services/`.
- [ ] `/ax:verify-ui` — new scenarios: graph view renders, click node opens detail, change edge type persists, add manual edge via Quick Link, remove manual edge, type change re-colors node, typed wikilink creates typed edge on save, removing wikilink removes content-source edge, list view + pinned view + backlinks view still work.
- [ ] MCP smoke test: call all 7 new tools + 5 existing context tools; all return expected shapes.
- [ ] Performance: load graph with 500 seeded nodes + 1500 edges; first render <2s; steady-state frame <16ms after layout settles.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Backfill migration corrupts existing `linkedEntryIds` | Low | Critical | Write the backfill as a reversible Prisma data migration; test on a dump first; keep the array column until Phase 8 verification. |
| Wikilink parser regressions break existing entries | Medium | High | Parser is a pure function in `@ascend/core` with unit tests; shared between server (on save) and client (preview). Test coverage ≥15 cases before shipping. |
| Graph view performance at 1000+ nodes janky | Medium | Medium | d3-force with `forceManyBody.theta` tuning; cap initial render at 1000; virtualized edge rendering with ReactFlow's built-in quadtree. |
| Content-source edges get duplicated with manual edges | Medium | Low | Unique constraint `(fromEntryId, toEntryId, type)` at DB level. When a manual edge exists and a wikilink of the same type is added, ignore (parser reads current DB state). |
| User confused by 9 edge types | Medium | Medium | v1 shows 4 types by default in the edge-type dropdown (REFERENCES, SUPPORTS, CONTRADICTS, SUPERSEDES); the rest in an "Advanced" submenu. Docs explain each with examples. Revisit after user testing. |
| Scope creep into AI suggestions or persistence | High | High | Explicit Out of Scope list; PR size discipline; W2 kickoff gated on W1 close. |

## Size Estimate

**Target: 15 working days solo.**

- Phase 1 (schema + enums + migration): 2 days.
- Phase 2 (`packages/graph` layout + wikilink parser in core): 2 days.
- Phase 3 (service layer): 2 days.
- Phase 4 (API routes): 1.5 days.
- Phase 5 (React Query hooks + cache keys): 1 day.
- Phase 6 (UI — graph view, edges panel, type select, quick link, view switcher): 4 days.
- Phase 7 (MCP tools round 1): 1 day.
- Phase 8 (full verification + cleanup + `linkedEntryIds` retirement): 1.5 days.

Buffer: 0 days — if we overrun, graph polish slips to W2 kickoff.

## Handoff to Wave 2

When Wave 1 closes, Wave 2 (AI-native MCP round 1) can start immediately. W2 requires:
- `ContextLink` table live with typed edges.
- `@ascend/core` exports edge types and wikilink parser for reuse.
- `/api/context/graph` and `/neighbors` endpoints working (LLM tools will query them).
- MCP graph tools working (same endpoints surfaced to AI).

W2 brings OpenAI integration, embeddings on every entry, retrieval-augmented conversations, and "suggest typed links" — all of which stand on W1's graph.
