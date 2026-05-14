# Wave 9: Spatial canvas view

**Slug:** `context-v2` / `wave-9-spatial-canvas`
**Created:** 14. 5. 2026
**Status:** done
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md) (W9 section, ~line 414)
**Wave sizing:** 2-3 weeks per VISION; target 10-13 working days at the cadence Waves 5, 7, and 8 hit.

## Problem

Ascend is now a deep system: notes, todos, goals, blocks, files, databases, an AI context map, a force-directed graph, a calendar, and Wave 7's time-travel layer. Every view is structured (list, tree, table, timeline, board, graph). None of them are spatial. The user cannot lay nodes out by hand, cluster them visually, sketch around them with arrows and notes, or use the canvas as a thinking surface. The graph view is rendered by d3-force every time it loads, so the positions are not persistent and the user cannot say "put this note next to that decision and lock it there." Visual thinkers (most engineers, designers, founders) think on infinite canvases, not in trees.

Wave 9 introduces a new top-level view alongside Outline/Graph/Pinned/Backlinks called "Map" (legacy VISION shorthand: "spatial canvas"). It is an infinite Excalidraw canvas where every ContextEntry can be dropped as a card, dragged to a fixed position, connected to other cards with typed arrows that map back to `ContextLink` rows, and surrounded by freehand drawings, shapes, sticky notes, and frames that live only on the canvas. Position data is persisted per layout in a new `CanvasLayout` table so the user's spatial arrangement survives reloads. Existing `.excalidraw` and `.tldr` files can be imported to seed a layout.

This makes Ascend not just a place to store thinking, but a place to do thinking visually. It complements the structural views with a freeform one. It is the smallest remaining Context v2 wave (2-3 weeks) and the right next step before tackling Wave 6 (Mobile) or Wave 10 (Extensibility).

## User Story

As a user, I want an infinite canvas view of my notes, goals, todos, and database rows so I can arrange them spatially, draw connections by hand, and use freehand sketching + sticky notes + frames to think around them. I want the layout to persist when I close the tab. I want to drop in `.excalidraw` files I sketched elsewhere and use them as the starting point of a Map. I want the arrows I draw on the canvas to become real typed links in the graph, and I want existing links to render as arrows when I enable that toggle. As an AI agent connected via MCP, I want to read the canvas layout, move a node to a specific position, and add an annotation programmatically.

## Success Criteria

### Functional

- [ ] **Excalidraw v0.18.1+ embedded** at `apps/web/components/context/canvas/context-canvas-view.tsx`. MIT-licensed (verified 14. 5. 2026 from github.com/excalidraw/excalidraw/blob/master/LICENSE). React 19 supported as of 0.18.0 (verified from issue #8923 closed). Required CSS import: `import "@excalidraw/excalidraw/index.css"`. Loaded via `next/dynamic({ ssr: false })` because Excalidraw is browser-only.
- [ ] **New `"canvas"` value on `ContextViewType`** (`apps/web/lib/stores/ui-store.ts`). Map button added to `apps/web/components/context/context-view-switcher.tsx` (icon: `Map` from lucide-react). Persisted in Zustand via the storage adapter exactly like the other 4 views.
- [ ] **`CanvasLayout` table (NEW)** — one row per user-owned layout. Schema in PRD "Data Model Changes". Columns: `id`, `userId`, `workspaceId`, `name`, `slug`, `isDefault`, `viewport` (JSONB with `x/y/zoom`), `canvas` (JSONB containing Excalidraw scene as `{ elements, appState, files }`), CHECK constraint `octet_length(canvas::text) <= 2097152` (2 MiB ceiling per layout), CHECK on viewport size.
- [ ] **`CanvasNode` table (NEW)** — per-node position within a layout. Columns: `id`, `canvasLayoutId` (FK CASCADE), `userId`, `workspaceId`, `contextEntryId` (FK CASCADE), `x` (float), `y` (float), `w` (float, default 240), `h` (float, default 140), `excalidrawElementId` (string; the Excalidraw element this card maps to so we can find the rectangle in the canvas blob on render), `createdAt`, `updatedAt`. `@@unique([canvasLayoutId, contextEntryId])` so a node appears at most once per layout.
- [ ] **Three node-card sizes** — Compact (240x80, title + type badge), Default (240x140, title + 2-line preview + badges), Expanded (360x220, title + 6-line preview + type badge + outgoing-link count + tags). Toggle on the canvas toolbar (per-layout setting persisted in `CanvasLayout.viewport.cardSize`). Cards rendered via `customData.kind === "node-card"` on a custom Excalidraw rectangle shape; the card body is overlaid in a positioned `<div>` synced to the rectangle's bounding box (Excalidraw API exposes `scrollX/Y/zoom` + element coords).
- [ ] **Edge rendering: existing `ContextLink` rows** — when `showEdges` is on (default on), every `ContextLink` whose endpoints both exist as `CanvasNode` rows in the active layout renders as an Excalidraw arrow with `startBinding` + `endBinding` to the corresponding card elements. Arrow color is mapped from `ContextLinkType` via the same palette as `apps/web/components/context/context-graph-view.tsx` (re-uses `@ascend/graph` `edgeColor`).
- [ ] **Edge creation: drag an arrow between two cards** — Excalidraw's native arrow tool, when the start + end bindings both land on `customData.kind === "node-card"` elements, fires the canvas's `onChange` handler. The handler diffs new `arrow + bindings` against the previous scene and, on a net-new arrow whose both endpoints bind to cards, opens a small modal: type picker (10 `ContextLinkType` options + DERIVED_FROM excluded since branching is Wave 7's job). On confirm, the handler calls `POST /api/context/links` with `{ fromEntryId, toEntryId, type, source: "CANVAS" }` (new `ContextLinkSource` value). On cancel, the arrow is removed from the scene.
- [ ] **Edge deletion: select an arrow + Delete** — removes the Excalidraw arrow AND the corresponding `ContextLink` via `DELETE /api/context/links/[id]` if the arrow has the `customData.linkId` tag.
- [ ] **`showEdges` toolbar toggle** — when off, all canvas arrows that have `customData.kind === "edge"` are visually hidden (kept in the scene but `opacity: 0` and non-interactive). When toggled back on, they re-appear. State persisted in `CanvasLayout.viewport.showEdges`.
- [ ] **Annotations: freehand, shapes, sticky notes, frames** — native Excalidraw elements stored as-is in `CanvasLayout.canvas`. No transformation. Not surfaced as ContextEntries.
- [ ] **Layout list + switcher** — sidebar on the canvas view shows a list of the user's layouts ("Personal", "Q2 planning", "Roadmap brainstorm"). Click to switch. "+ New layout" button at the bottom. First-time users get a "Personal" layout auto-created on first visit to the canvas view.
- [ ] **Auto-save** — debounced 1.5s after the last canvas edit, persists the Excalidraw scene to `CanvasLayout.canvas` and any new/changed `CanvasNode` rows. On idle blur, fires immediately. Status pill in the toolbar: "Saved" / "Saving..." / "Save failed — Retry".
- [ ] **Drag-from-sidebar to canvas** — drag a ContextEntry from the left sidebar (categories tree or list) onto the canvas → creates a card at the drop point, creates a `CanvasNode` row, persists. If the entry is already on the layout, the drop is a no-op + toast "Already on this canvas."
- [ ] **Slash menu on canvas** — Cmd+K opens an entry picker. Selecting an entry creates a card at the canvas center.
- [ ] **`.excalidraw` import** — slash menu item "Import .excalidraw". File picker → reads the file → replaces the current scene's `elements`/`files` (warns if the layout is non-empty). No transformation; Excalidraw files are the native format. **No commercial import service is called.**
- [ ] **`.tldr` import: dropped from W9 scope (Phase 0 spike finding, 14. 5. 2026).** Investigation: `@tldraw/file-format` on npm is a stale canary from 3 years ago; the real `.tldr` parser lives at `packages/tldraw/src/lib/utils/tldr/file.ts` inside the proprietary tldraw SDK (watermark on hobby, multi-MB bundle, license key required for production). No community-maintained standalone parser exists. Pulling in the full SDK just for parse is wrong. The fallback in the toolbar's Import dialog reads: "Tldraw (.tldr) import is not supported. Please export your tldraw drawing to .excalidraw first." with a help link to tldraw's export docs. Tracked in BACKLOG for revisit if a community parser emerges.
- [ ] **Layout export** — toolbar "Export" button downloads the current scene as `<layout-name>.excalidraw`.
- [ ] **Three MCP tools (round 9)** — `get_canvas_layout`, `set_node_position`, `create_annotation`. Zod-validated, userId+workspaceId-scoped via factory binding. Tool count: **76 → 79**.
- [ ] **Time-travel-aware** — when the Wave 7 graph time slider is set to a past date AND the user switches to the canvas view, the canvas falls back to read-only mode with banner: "Map view shows current state only. To time-travel, switch to Graph view." (Per-layout history is out of scope; documented in "Out of Scope".)
- [ ] **Workspace-scoped** — every `CanvasLayout`, `CanvasNode`, and read/write call passes `workspaceId` through the auth context per Wave 8 rules. `permissionService.assertCanPerform(... "WRITE_NODE")` gates writes.
- [ ] **Yjs realtime collaboration (read-only mention)** — Wave 8 CRDT covers BlockDocument editor only. The canvas in Wave 9 is single-user / single-tab in v1; concurrent edits in two tabs follow a "last write wins" auto-save model. Realtime canvas collab is explicitly deferred (see "Out of Scope").

### Quality

- [ ] **Initial render under 250ms** for a layout with 50 nodes + 100 edges + 200 freehand strokes (95th percentile, measured locally on M-series macOS).
- [ ] **Drag latency under 16ms** (60 fps) per Excalidraw element move on a layout of the same size.
- [ ] **Auto-save round-trip under 400ms** for a 200-element scene (Excalidraw payload + canvas node deltas) on the prod database.
- [ ] **Canvas blob size capped at 2 MiB** via DB CHECK constraint + pre-flight pre-write check in service.
- [ ] **`tsc --noEmit` and `pnpm build` pass with zero errors at every commit.**
- [ ] **`ascend-security` audit on canvas routes: PASS.** Every Prisma query includes `userId` + `workspaceId`. Edge creation/deletion routes call `permissionService.assertCanPerform`. Import endpoints accept-validate file size + parse-validate before inserting.
- [ ] **`ascend-migration-auditor` PASS** on every migration. Additive only. Never touch `search_vector`. Hand-written per safety rule 6.
- [ ] **`ascend-reviewer` PASS** on the service layer (DZ-1 transaction discipline applied where multiple writes happen together).
- [ ] **`ascend-architect` PASS** — Excalidraw stays in `apps/web` only; `packages/*` only gains canvas schema types (`@ascend/core`).
- [ ] **`ascend-critic` verdict at GOOD or WORLD-CLASS at wave close.**
- [ ] **`ax:verify-ui` PASS** on the success-test scenarios in this PRD.

### Cross-platform readiness

- [ ] **Canvas schemas in `@ascend/core`** (`packages/core/src/schemas/canvas.ts`) — `canvasLayoutSchema`, `canvasNodeSchema`, `excalidrawSceneSchema` (loose: just `{ elements, appState, files }` with size limits; Excalidraw's full ElementType tree is too large to mirror), `setNodePositionSchema`, `createAnnotationSchema`, `getCanvasLayoutQuerySchema`. Re-exported from `apps/web/lib/validations.ts`.
- [ ] **No Excalidraw types leak into shared packages.** `packages/*` may import the `@excalidraw/excalidraw` types as a peerDep ONLY if needed — currently not needed; the JSONB blob is opaque to shared code.
- [ ] **Mobile (Wave 6) consumes** the CanvasLayout + CanvasNode API + the 3 MCP tools when shipped; the canvas itself is rendered with a native canvas library on mobile (not Excalidraw).
- [ ] **MCP tools fully agent-usable** — every tool returns structured JSON. `get_canvas_layout` returns the JSONB scene + the CanvasNode list. `set_node_position` returns the updated CanvasNode. `create_annotation` returns the created Excalidraw element ID.

## Affected Layers

- **Prisma schema:**
  - **`ContextLinkSource` enum extended** with `CANVAS` (in addition to existing `CONTENT`, `MANUAL`).
  - **`CanvasLayout` table (NEW)**: `id`, `userId`, `workspaceId`, `name String (1-200)`, `slug String` (unique per user via `@@unique([userId, slug])`), `isDefault Boolean @default(false)`, `viewport Json` (`{x, y, zoom, showEdges, cardSize}`), `canvas Json` (the Excalidraw scene), `createdAt`, `updatedAt`. Indexes: `@@index([userId, updatedAt(sort: Desc)])`, `@@index([workspaceId])`. CHECK: `octet_length(canvas::text) <= 2097152`.
  - **`CanvasNode` table (NEW)**: `id`, `canvasLayoutId String (FK CASCADE)`, `userId`, `workspaceId`, `contextEntryId String (FK CASCADE)`, `x Float`, `y Float`, `w Float @default(240)`, `h Float @default(140)`, `excalidrawElementId String`, `createdAt`, `updatedAt`. Indexes: `@@unique([canvasLayoutId, contextEntryId])`, `@@unique([canvasLayoutId, excalidrawElementId])`, `@@index([userId])`, `@@index([workspaceId])`. CASCADE delete from both canvasLayoutId AND contextEntryId.

- **Packages:**
  - **`@ascend/core` (`packages/core/src/schemas/canvas.ts`, NEW)** — schemas above. Pure TS + Zod, no DOM.
  - **No new package needed.** The Excalidraw component lives entirely in `apps/web`. The PRD's "engine" recommendation is to NOT extract a `@ascend/canvas` package in W9 because the component is browser-only and the data shape is already in `@ascend/core`.

- **Service layer (`apps/web/lib/services/`):**
  - **`canvas-layout-service.ts` (new)** — `list(userId, workspaceId)`, `getById(userId, workspaceId, id)`, `getBySlug(userId, workspaceId, slug)`, `getDefault(userId, workspaceId)` (creates the "Personal" default if missing on first call, transactionally), `create(userId, workspaceId, input)`, `update(userId, workspaceId, id, input)` (size pre-flight + permission check), `delete(userId, workspaceId, id)` (CASCADE handles nodes; verify it's not the only layout — refuses to delete the last). Owns the 2 MiB pre-flight per safety rule.
  - **`canvas-node-service.ts` (new)** — `listForLayout(userId, workspaceId, layoutId)`, `upsert(userId, workspaceId, layoutId, contextEntryId, position)`, `bulkUpsert(userId, workspaceId, layoutId, positions[])` for autosave delta apply (raw SQL `INSERT ... ON CONFLICT` with `userId + workspaceId` guard, similar to `databaseRelationService.diffAndApply`), `removeFromLayout(userId, workspaceId, layoutId, contextEntryId)`. Permission-gated on every mutation.
  - **`canvas-import-service.ts` (new)** — `parseExcalidrawFile(buffer): {elements, appState, files}` (size-checked, structure-validated), `parseTldrFile(buffer): {elements, appState}` (best-effort shape mapping). Pure parsing, no DB writes. Called by the API route which then hands the parsed scene to `canvasLayoutService.update`.
  - **No edge service additions.** Canvas edge creation uses the existing `apps/web/lib/services/context-link-service.ts` `create` and `delete` methods. The "CANVAS" source value is the only enum addition.
  - **Snapshot triggers (Wave 7):** canvas changes do NOT trigger NodeVersion snapshots (canvas position is metadata about a node, not the node's content). Documented in code with `// no scheduleSnapshot — canvas position is layout metadata, not content`. Wave 7 versioning continues to fire on the entry's own edits.
  - **Activity events (Wave 8):** add `CANVAS_LAYOUT_CREATED`, `CANVAS_NODE_ADDED`, `CANVAS_NODE_REMOVED` to the `ActivityEventType` enum. Each fired from the corresponding service's create/delete path. Snapshot/move events are NOT logged (too noisy).

- **API routes (`apps/web/app/api/`):**
  - `GET /api/canvas/layouts` → list user's layouts (paginated, default 20).
  - `POST /api/canvas/layouts` → create.
  - `GET /api/canvas/layouts/[id]` → fetch full layout + nodes.
  - `PATCH /api/canvas/layouts/[id]` → update name / slug / viewport / canvas scene. Single endpoint, partial body.
  - `DELETE /api/canvas/layouts/[id]` → delete.
  - `POST /api/canvas/layouts/[id]/nodes` → bulk-upsert CanvasNode positions (autosave delta path).
  - `DELETE /api/canvas/layouts/[id]/nodes/[contextEntryId]` → remove node from layout.
  - `POST /api/canvas/import` → multipart body `{ file, format: "excalidraw" | "tldr", layoutId, mode: "replace" | "merge" }`. Returns the updated scene.
  - All routes follow the auth-parse-service-respond pattern. Use `authenticate` from `apps/web/lib/auth.ts`. Body validated via Zod from `apps/web/lib/validations.ts`. `permissionService.assertCanPerform(... "WRITE_NODE")` on writes.

- **React Query hooks (`apps/web/lib/hooks/use-canvas.ts`, NEW):**
  - `useCanvasLayouts()` — list, 30s staleTime.
  - `useCanvasLayout(id | null)` — detail + nodes, 30s staleTime, conditional `enabled: !!id`.
  - `useCreateLayout()`, `useUpdateLayout()`, `useDeleteLayout()`, `useUpsertNodes()`, `useRemoveNode()`, `useImportFile()`.
  - **Cache keys** added to `apps/web/lib/queries/keys.ts`:
    ```ts
    canvas: {
      all: () => ["canvas"] as const,
      layouts: () => [...keys.canvas.all(), "layouts"] as const,
      layout: (id: string | null) => [...keys.canvas.all(), "layout", id ?? null] as const,
      nodes: (layoutId: string) => [...keys.canvas.all(), "nodes", layoutId] as const,
    },
    ```
  - **Cross-domain invalidation:**
    - `useUpsertNodes.onSuccess` → invalidate `keys.canvas.layout(id)` + `keys.activity.all()`.
    - `useImportFile.onSuccess` → invalidate `keys.canvas.layout(id)` + `keys.activity.all()`.
    - `useDeleteLayout.onSuccess` → invalidate `keys.canvas.layouts()` + `keys.activity.all()`.
    - Edge creation from canvas → uses existing `useCreateContextLink` from `apps/web/lib/hooks/use-context.ts` which already invalidates `keys.context.links.all()` + `keys.context.graph()`.

- **UI components (`apps/web/components/context/canvas/`, NEW):**
  - **`context-canvas-view.tsx`** — top-level canvas mount. Loaded via `next/dynamic({ ssr: false })`. Owns the Excalidraw `excalidrawAPI` ref, the autosave debounce, the layout switcher, the toolbar, the drag-from-sidebar drop handler.
  - **`canvas-toolbar.tsx`** — top bar with: layout switcher dropdown, "+ New layout" button, edge toggle, card-size toggle, Export, Import (slash menu trigger), "Saved" status pill.
  - **`canvas-card-overlay.tsx`** — for each `CanvasNode`, renders an absolutely-positioned `<div>` synced to the Excalidraw rectangle's screen coords (via `excalidrawAPI.getAppState()` for `scrollX/Y/zoom`). Card body shows title + type badge + preview text + outgoing-link count. Click → opens entry detail in a side panel (or replaces the right panel content with the detail).
  - **`canvas-card-empty-state.tsx`** — when a layout has zero nodes, render a centered "Drag entries from the sidebar to start" + a "Quick-add 5 entries" button (picks 5 most-recently-edited).
  - **`canvas-link-type-picker.tsx`** — modal that appears when a new arrow is drawn between two cards. Lists the 10 `ContextLinkType` options (REFERENCES, MENTIONS, RELATES_TO, CONTRADICTS, SUPPORTS, DEPENDS_ON, DERIVED_FROM, PARENT, CHILD, DATABASE_RELATION — actually skip the ones not user-facing; final list TBD in Phase 5 review).
  - **`canvas-layout-rename-dialog.tsx`** — inline rename for a layout (used in the dropdown).
  - **`canvas-import-dialog.tsx`** — file picker + format detection + "replace existing scene" warning + import.

- **View switcher extension:**
  - `apps/web/components/context/context-view-switcher.tsx` — add 5th option `{ value: "canvas", label: "Map", icon: Map }`.
  - `apps/web/app/(app)/context/page.tsx` — the switch on `contextActiveView` at line 315 gains a `case "canvas":` branch that mounts `<ContextCanvasView />`. For canvas view, the left panel (currently the entry list) collapses to a narrow rail and the canvas takes most of the screen, similar to how graph view at line 278 (`isGraphView`) is treated.

- **Drag-from-sidebar pattern:**
  - `apps/web/components/context/context-entry-list.tsx` — each row becomes `draggable` with `dataTransfer` carrying `{ type: "ascend:entry", id }`.
  - `apps/web/components/context/canvas/context-canvas-view.tsx` — top-level `onDragOver` + `onDrop` handlers parse the transfer payload, compute canvas-coordinate drop position from the `clientX/Y`, call `upsertNodes` mutation.

- **MCP tools (`apps/web/lib/mcp/tools/canvas-tools.ts`, NEW):**
  - `get_canvas_layout(layoutId?)` — returns the layout + nodes. If no layoutId, returns the default. Userid+workspaceId-scoped via factory.
  - `set_node_position(layoutId, contextEntryId, x, y, w?, h?)` — upserts CanvasNode.
  - `create_annotation(layoutId, kind: "freehand" | "rectangle" | "ellipse" | "text" | "sticky" | "frame", geometry, content?)` — appends an Excalidraw element to the layout's canvas scene. Server-side: parses the existing scene, generates a new Excalidraw element with `customData.kind: "annotation"` and the geometry, appends, persists.

- **Zustand store:** `apps/web/lib/stores/ui-store.ts`:
  - Extend `ContextViewType` to include `"canvas"`.
  - Add `canvasActiveLayoutId: string | null` (persisted) so the user's last-opened layout is restored.
  - Add `canvasLinkTypePickerOpen: { fromEntryId: string; toEntryId: string; pendingArrowId: string } | null` (transient) — the in-flight edge creation state.

- **Cron / queues:** none (canvas state is interactive; no background work).

## Data Model Changes

```prisma
enum ContextLinkSource {
  CONTENT
  MANUAL
  CANVAS  // NEW
}

model CanvasLayout {
  id           String       @id @default(cuid())
  userId       String
  workspaceId  String
  name         String
  slug         String
  isDefault    Boolean      @default(false)
  viewport     Json         // { x, y, zoom, showEdges, cardSize }
  canvas       Json         // Excalidraw scene: { elements, appState, files }
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace    Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  nodes        CanvasNode[]

  @@unique([userId, slug])
  @@index([userId, updatedAt(sort: Desc)])
  @@index([workspaceId])
}

model CanvasNode {
  id                    String       @id @default(cuid())
  canvasLayoutId        String
  userId                String
  workspaceId           String
  contextEntryId        String
  x                     Float
  y                     Float
  w                     Float        @default(240)
  h                     Float        @default(140)
  excalidrawElementId   String
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt

  canvasLayout          CanvasLayout @relation(fields: [canvasLayoutId], references: [id], onDelete: Cascade)
  user                  User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace             Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  contextEntry          ContextEntry @relation(fields: [contextEntryId], references: [id], onDelete: Cascade)

  @@unique([canvasLayoutId, contextEntryId])
  @@unique([canvasLayoutId, excalidrawElementId])
  @@index([userId])
  @@index([workspaceId])
}
```

CHECK constraints (hand-written in raw SQL migration; not expressible in Prisma):

```sql
ALTER TABLE "CanvasLayout"
  ADD CONSTRAINT "CanvasLayout_canvas_size_max" CHECK (
    octet_length("canvas"::text) <= 2097152
  );

ALTER TABLE "CanvasLayout"
  ADD CONSTRAINT "CanvasLayout_viewport_size_max" CHECK (
    octet_length("viewport"::text) <= 8192
  );
```

Migration order:

1. `20260514000001_add_canvas_source_to_context_link_source` — extends `ContextLinkSource` enum with `CANVAS`. Single `ALTER TYPE ... ADD VALUE`.
2. `20260514000002_add_canvas_layout` — `CanvasLayout` table + 2 CHECK constraints + indexes + inverse relations on `User` and `Workspace`.
3. `20260514000003_add_canvas_node` — `CanvasNode` table + indexes + inverse relations on `User`, `Workspace`, `CanvasLayout`, `ContextEntry`.

All three are additive. None touch `search_vector`. All hand-written per safety rule 6.

No backfill required (canvas layouts are opt-in; a "Personal" default is created lazily on first visit).

## API Contract

### `GET /api/canvas/layouts`

Lists user's layouts in the current workspace, newest-updated first.

Response:
```json
{
  "layouts": [
    {
      "id": "ck...",
      "name": "Personal",
      "slug": "personal",
      "isDefault": true,
      "viewport": { "x": 0, "y": 0, "zoom": 1, "showEdges": true, "cardSize": "default" },
      "nodeCount": 12,
      "updatedAt": "2026-05-14T08:00:00Z"
    }
  ]
}
```

Note: `canvas` (the Excalidraw scene blob) is OMITTED from the list response. Only `GET /api/canvas/layouts/[id]` returns the full scene.

### `POST /api/canvas/layouts`

Body: `{ "name": "Q2 planning", "slug?": "q2-planning" }`. Slug auto-derived from name if missing.

Response: `{ "layout": { id, name, slug, ... }, "nodes": [] }` (empty new layout).

### `GET /api/canvas/layouts/[id]`

Returns the full layout including `canvas` (the Excalidraw scene blob) and the array of `CanvasNode` rows.

Response:
```json
{
  "layout": {
    "id": "ck...",
    "name": "Personal",
    "slug": "personal",
    "isDefault": true,
    "viewport": {...},
    "canvas": { "elements": [...], "appState": {...}, "files": {...} },
    "updatedAt": "..."
  },
  "nodes": [
    { "id": "ck...", "contextEntryId": "ck...", "x": 100, "y": 200, "w": 240, "h": 140, "excalidrawElementId": "..." }
  ]
}
```

### `PATCH /api/canvas/layouts/[id]`

Body (any subset of):
```json
{
  "name": "...",
  "slug": "...",
  "viewport": {...},
  "canvas": {...}  // full Excalidraw scene; pre-flight 2 MiB check
}
```

Response: `{ "layout": {...} }`.

### `DELETE /api/canvas/layouts/[id]`

Refuses with 400 if `isDefault: true` and there are no other layouts. Otherwise CASCADE deletes all CanvasNode rows for the layout.

Response: `204 No Content`.

### `POST /api/canvas/layouts/[id]/nodes`

Body: `{ "upsert": [{ contextEntryId, x, y, w?, h?, excalidrawElementId }], "remove": [contextEntryId] }`.

Bulk-upsert + bulk-remove in a single transaction.

Response: `{ "nodes": [...] }` (full updated list for the layout).

### `DELETE /api/canvas/layouts/[id]/nodes/[contextEntryId]`

Convenience single-remove endpoint (alternative to the bulk path).

### `POST /api/canvas/import`

Multipart body: `file` (binary), `format` (`"excalidraw"` | `"tldr"`), `layoutId` (string), `mode` (`"replace"` | `"merge"`).

Response (success): `{ "layout": {...}, "warnings": ["Skipped 3 unsupported shape types"] }`.

100 MiB file size cap (matches Wave 0 file pipeline). Parse-validate before writing. 4xx with structured error on parse failure.

## UI Flows

### Switching to the Map view

1. User opens `/context`. Existing 4 view buttons: List / Graph / Pinned / Backlinks.
2. A 5th button "Map" appears in the view switcher (lucide `Map` icon).
3. Click "Map" → `contextActiveView = "canvas"` → `ContextCanvasView` mounts (loaded via `next/dynamic` so the Excalidraw bundle is code-split).
4. On first visit, the service creates a "Personal" default layout transactionally. The canvas opens empty with the empty state "Drag entries from the sidebar..."
5. Subsequent visits restore the last-opened layout via `useUIStore.canvasActiveLayoutId`.

### Adding a node by drag

1. User drags an entry from the left sidebar (entry list or category tree) onto the canvas.
2. `onDragOver` shows a faint drop indicator.
3. `onDrop` parses the transfer payload `{ type: "ascend:entry", id }`, computes the canvas-coordinate drop position from `event.clientX/Y` via `excalidrawAPI.getAppState()` viewport math.
4. Mutation fires: creates a CanvasNode row + appends an Excalidraw rectangle element with `customData.kind = "node-card"` and the contextEntryId.
5. Card overlay renders synced to the rectangle's screen coords.
6. Toast: "Added to Map."

### Drawing an edge between two cards

1. User picks the Excalidraw arrow tool, drags from card A to card B.
2. Excalidraw's bindings system snaps the arrow's endpoints to the nearest element edges.
3. Canvas `onChange` handler diffs the scene. Detects: a new arrow element exists with `startBinding.elementId === <card-A-rect>` and `endBinding.elementId === <card-B-rect>`.
4. `canvasLinkTypePickerOpen` is set in Zustand. The `CanvasLinkTypePicker` modal opens listing the typed link options.
5. User picks a type. The handler calls `useCreateContextLink.mutateAsync({ fromEntryId: A, toEntryId: B, type, source: "CANVAS" })`. On success, the arrow's `customData.linkId` is set so future deletes can map back. Modal closes.
6. User cancels → the arrow is removed from the scene (next autosave flush will persist the cleanup).

### Toggling edge rendering

1. User clicks the "Edges" toolbar toggle.
2. `viewport.showEdges` flips.
3. All elements with `customData.kind === "edge"` have their `opacity` set to 0 and `locked: true`. Re-toggle restores.
4. State persists via the next autosave.

### Renaming a layout

1. User opens the layout-switcher dropdown.
2. Click the kebab next to a layout name → "Rename" → opens `CanvasLayoutRenameDialog`.
3. Enter new name → Save → `PATCH /api/canvas/layouts/[id]` with `{ name }`.

### Importing an .excalidraw file

1. User clicks the "Import" button on the toolbar.
2. File picker accepts `.excalidraw`, `.tldr`.
3. On file selection, `canvas-import-service.parseExcalidrawFile` parses the file in the browser via the file API (Excalidraw's `loadFromBlob` helper).
4. If the current layout has content, a warning modal appears: "This layout has 12 elements. Replace or merge?"
5. On confirm, POST `/api/canvas/import` with the file binary + chosen mode.
6. The server-side service merges or replaces and returns the updated scene. Hook invalidates the layout cache, the canvas re-renders.

### Time-travel interaction (Wave 7 compatibility)

1. User has the graph time slider set to a past date.
2. User switches to Map view.
3. Banner: "Map view shows current state only. To time-travel, switch to Graph view."
4. Canvas is read-only (Excalidraw `viewModeEnabled`).
5. Slider's "Return to now" pill works exactly as before.

## Cache Invalidation

| Mutation | Invalidates |
|---|---|
| `useCreateLayout` | `keys.canvas.layouts()`, `keys.activity.all()` |
| `useUpdateLayout` (name/viewport/canvas) | `keys.canvas.layout(id)`. Does NOT invalidate the layouts list (the list endpoint omits canvas; only `updatedAt` changes — handled via opportunistic background refetch on next list mount). |
| `useDeleteLayout` | `keys.canvas.layouts()`, `keys.canvas.layout(id)` (set to null), `keys.activity.all()` |
| `useUpsertNodes` | `keys.canvas.layout(id)`, `keys.activity.all()` |
| `useRemoveNode` | `keys.canvas.layout(id)`, `keys.activity.all()` |
| `useImportFile` | `keys.canvas.layout(id)`, `keys.activity.all()` |
| Edge created via `useCreateContextLink` (canvas-source) | Already invalidates `keys.context.links.all()`, `keys.context.graph()`. ADD: `keys.canvas.layout(id)` so the arrow's `customData.linkId` propagates back into the cached scene. |
| Edge deleted via `useDeleteContextLink` (canvas-source) | Same as above plus `keys.canvas.layout(id)`. |
| `useCreateContextEntry` (when a new node is added that might be relevant to a canvas) | Existing invalidations preserved; NOT invalidating canvas (the new entry is not auto-added to any layout). |

## Danger Zones Touched

This wave introduces 2 new danger zones. None of DZ-1 through DZ-24 are directly aggravated.

- **DZ-25 (NEW): Canvas blob storage runaway.** A user (or a buggy autosave path) could push a 50 MiB Excalidraw scene full of embedded base64 images. Mitigations: (a) per-layout DB CHECK constraint at 2 MiB; (b) service-layer pre-flight in `canvasLayoutService.update` rejects payloads larger than 2 MiB with a clear error; (c) Excalidraw's `files` map (which stores embedded image base64) is moved to Ascend's `File` model + R2 (re-uses Wave 4 pipeline) — images in canvas use presigned URLs, not embedded base64; (d) per-route Content-Length pre-check at the Next.js route handler (4 MiB body cap); (e) the 2 MiB ceiling allows ~2k typical elements + freehand strokes per layout, which is well past normal user need.

- **DZ-26 (NEW): Edge creation noise on the canvas.** A pathological autosave loop or a buggy onChange could detect "new arrows" repeatedly and spam `POST /api/context/links`. Mitigations: (a) the type-picker modal is the only path to actually CREATE a ContextLink; closing the modal removes the proposed arrow; (b) `useCreateContextLink`'s `mutate` is idempotent (server upserts by `(fromEntryId, toEntryId, type)`), so re-firing is safe; (c) the autosave handler tracks arrow ids it has already prompted on (via `customData.linkId` set after creation, OR a session `Set<string>` of arrowIds whose type-picker has been opened and dismissed); (d) `permissionService.assertCanPerform` rate-limits per workspace (the existing service-layer guard). For a runaway loop scenario at the protocol level, the existing `crdt-rate-limit-service` pattern can be adapted later if needed.

## Out of Scope

- **Realtime collaborative canvas.** Wave 9 ships single-user / single-tab. Concurrent tabs from the same user use "last write wins" auto-save. Yjs binding to Excalidraw's scene format is real engineering work (Excalidraw is not Yjs-native; the official Excalidraw collab uses a custom protocol) and is deferred.
- **Per-canvas time travel.** Wave 7 versions ContextEntry, Goal, Todo, DatabaseRow, DatabaseField. Adding CanvasLayout / CanvasNode to the NodeVersion polymorphic table is intentionally deferred; canvas state restoration is best done via the Excalidraw "Save as file" export + later re-import.
- **Mobile canvas.** Excalidraw on touch screens is functional but not great; mobile gets a read-only "Map" view in Wave 6 (when shipped) that renders a thumbnail of each layout, with full editing deferred to a future polish wave.
- **Embedded canvases inside notes.** A NOTE's BlockDocument could host an inline canvas block. Deferred to Wave 10 extensibility / a future polish wave. The current `EmbedNode` Lexical node remains a placeholder.
- **AI-generated canvases.** "Layout my workspace as a graph" via the LLM is a natural extension but adds prompt + token cost considerations. Defer.
- **Per-link annotations on the canvas.** Sticky notes attached to a specific edge with persistence. Deferred; users can place a free sticky near an arrow today.
- **Snap-to-grid / alignment guides.** Excalidraw has none natively; adding it is a bigger UX investment. Defer.
- **Layout sharing / public publishing.** Wave 8b carryover (public publishing) covers all entity types; canvas sharing inherits from that when it lands.
- **`User.role` admin routes.** Not touched.
- **Branch view of canvas changes.** Wave 7 branching is BlockDocument-only.

## Open Questions

1. **Card overlay vs custom Excalidraw element.** Excalidraw's plugin system allows custom element types via `customData`, but rendering rich React content (badges, link counts, type icons) inside a custom element is non-trivial — Excalidraw renders to canvas, not DOM. The PRD's "card overlay synced to rectangle screen coords" is the standard approach (used by Excalidraw's "embeddable" element family). Confirm in Phase 3 spike that overlay rendering performs at 60 fps for 50 cards during pan/zoom.
2. **`.tldr` import dependency licensing.** RESOLVED in Phase 0 spike (14. 5. 2026): no standalone parser available, `@tldraw/file-format` is a 3-year-old abandoned canary, the actual parser is inside the proprietary tldraw SDK. `.tldr` import is dropped from W9; the UI shows a "not supported" message with a help link.
3. **Link type picker enum coverage.** Of the 11 `ContextLinkType` values, DERIVED_FROM (Wave 7 branching) and DATABASE_RELATION (Wave 5 relation fields) are system-generated; PARENT and CHILD describe goal hierarchy. Should the canvas type picker show ALL 11 or only the 5 free-form ones (REFERENCES, MENTIONS, RELATES_TO, CONTRADICTS, SUPPORTS, DEPENDS_ON)? Recommendation: 6 free-form. Confirm in Phase 5 review.
4. **Default card size.** Compact 240x80 vs Default 240x140 vs Expanded 360x220. Recommendation: Default 240x140 as the initial value, with the toolbar toggle persisting per-layout choice. Confirm in `ascend-ux` review during Phase 4.
5. **Empty-state copy.** "Drag entries from the sidebar to start" vs "Add your first card by ⌘K + entry name." Recommendation: both, side by side. Confirm in Phase 4.
6. **Autosave granularity.** Full canvas blob every 1.5s vs only-changed-elements delta. Recommendation: full blob with content-hash dedup at the service level (skip the write if the hash matches current). Excalidraw's blobs are small enough (typical layout under 200 KiB) that delta optimization is premature.
7. **Where does the canvas mount when `contextActiveView === "canvas"`?** Current `context-page.tsx` has a two-panel layout; the graph view replaces the left panel entirely (`isGraphView`). Canvas should likely do the same: full-bleed canvas with a narrow rail on the right for entry detail when a card is clicked. Confirm in Phase 4.

## Success Test (smoke at wave close)

Manual smoke (10-15 minutes, after `/ax:verify-ui` passes):

1. Switch to Map view from a logged-in `/context` session. Confirm the "Personal" default layout auto-creates and the empty state appears.
2. Drag 5 ContextEntries from the sidebar onto the canvas. Confirm cards appear at the drop positions. Refresh the browser. Confirm cards persist at the same positions.
3. Draw an arrow with the Excalidraw arrow tool from card A to card B. Confirm the type-picker modal opens. Pick "REFERENCES." Confirm the arrow gets the type color from `@ascend/graph` and a `ContextLink` row is created (verify by switching to Graph view and seeing the new edge).
4. Toggle the "Edges" button. Confirm all edges hide. Toggle again. Confirm they reappear.
5. Toggle the card-size toggle. Confirm cards resize and the choice persists across a refresh.
6. Create a second layout "Q2 planning" from the toolbar. Confirm the dropdown switches to it. Confirm the empty state.
7. Sketch with the freehand tool. Add a sticky note. Add a frame around 3 cards. Confirm autosave fires (toolbar pill goes "Saving..." → "Saved"). Refresh. Confirm all annotations persist.
8. Import an `.excalidraw` file (use one of Amadej's existing files). Confirm the scene replaces (or merges per chosen mode) and the file's elements appear on the canvas.
9. Test time-travel banner: set the graph time slider to 14 days ago, switch to Map view, confirm the read-only banner appears.
10. MCP smoke (via curl with API key):
    - `get_canvas_layout` returns the active layout's scene + nodes.
    - `set_node_position(layoutId, contextEntryId, x: 500, y: 300)` moves a card; refresh the browser, confirm it's at the new position.
    - `create_annotation(layoutId, kind: "sticky", geometry: {x: 100, y: 100, w: 200, h: 100}, content: "MCP-added sticky")` adds a sticky; refresh, confirm it's there.
11. Delete a layout (must not be the default). Confirm the layout list updates and CanvasNode rows for that layout are gone (CASCADE).
12. Confirm `ActivityEvent` rows fired for `CANVAS_LAYOUT_CREATED`, `CANVAS_NODE_ADDED`, `CANVAS_NODE_REMOVED` by visiting `/activity`.
