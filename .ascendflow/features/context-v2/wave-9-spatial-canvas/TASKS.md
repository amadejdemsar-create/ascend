# Implementation Tasks: Wave 9 (Spatial canvas view)

**PRD:** [PRD.md](./PRD.md)
**Sizing:** 10-13 working days. 11 phases. Each phase ends in a single commit.

Order matters. Each task references actual files. After every phase, run `/ax:test`. Phases are dependency-ordered: Phase N+1 may assume Phase N landed.

## Phase 0: tldraw and Excalidraw spike + license check (CLOSED 14. 5. 2026)

- [x] **Spike: install + mount Excalidraw (CLOSED).** @excalidraw/excalidraw@^0.18.1 installed in apps/web (commit a56d68f). Peer-dep warnings expected and accepted (Excalidraw runtime supports React 19 from v0.18.0+ per issue #8923). Spike page deployed to prod at /spike/canvas; Excalidraw toolbar + canvas rendered correctly on a live JWT-gated route. TypeScript + production build both clean.

- [x] **Spike: custom card overlay (DEFERRED to Phase 4/5).** Cards rendered but layout-positioning math has bugs (overlap at one origin) and the FPS HUD was hidden behind Excalidraw's canvas (z-index battle). Iterating on prod is too expensive (5-7 min per redeploy) to debug here. 60fps measurement deferred to /ax:verify-ui during Phase 4 + 5 when canvas-view is fully wired locally. PRD Open Question 1 documents the two fallback strategies if perf doesn't meet target: (a) useSyncExternalStore subscription to Excalidraw onChange, (b) render cards as Excalidraw custom shapes via customData instead of DOM overlay.

- [x] **Spike: `.tldr` parse via `@tldraw/file-format` (RESOLVED 14. 5. 2026).** Finding: `@tldraw/file-format` on npm is a stale 3-year-old canary, not maintained. Real parser is bundled inside the proprietary tldraw SDK (watermark + multi-MB bundle). No community-maintained standalone parser exists. **Outcome:** `.tldr` import is dropped from W9 scope. The toolbar Import dialog only accepts `.excalidraw`. The dialog explains: "Tldraw (.tldr) import is not supported. Please export your tldraw drawing to .excalidraw first." with a help link.

- [x] **Delete the spike (DONE 14. 5. 2026).** `rm -rf apps/web/app/(app)/spike/`. Spike was at `spike/` not `_spike/` per the routing fix during the phase.

- [x] **`/ax:test`** to confirm the working tree is clean post-spike removal.

- [x] **Commit: feat(wave-9-phase-0-close): remove spike, keep Excalidraw install.** Phase 1 starts after this lands.

## Phase 1: Schema + Zod schemas + migrations

- [ ] **Schema additions in `apps/web/prisma/schema.prisma`**:
  - Extend `ContextLinkSource` enum with `CANVAS`.
  - Add `CanvasLayout` model with all fields + indexes + CHECK constraints per PRD "Data Model Changes".
  - Add `CanvasNode` model with `@@unique([canvasLayoutId, contextEntryId])` + `@@unique([canvasLayoutId, excalidrawElementId])` + indexes.
  - Add inverse relations on `User`, `Workspace`, `ContextEntry` (`canvasLayouts`, `canvasNodes`).

- [ ] **Hand-write 3 migrations** (per safety rule 6):
  - `apps/web/prisma/migrations/20260514000001_add_canvas_source_to_context_link_source/migration.sql` — `ALTER TYPE "ContextLinkSource" ADD VALUE 'CANVAS'`.
  - `apps/web/prisma/migrations/20260514000002_add_canvas_layout/migration.sql` — `CREATE TABLE "CanvasLayout"` with 2 CHECK constraints + indexes.
  - `apps/web/prisma/migrations/20260514000003_add_canvas_node/migration.sql` — `CREATE TABLE "CanvasNode"` with 2 unique indexes + 2 regular indexes + FKs.
  - Use `apps/web/prisma/migrations/20260512*_wave8b_*/migration.sql` as the formatting template (Wave 8b's most recent additive migration).
  - Apply locally via `pnpm prisma migrate deploy` (NOT `dev` — DZ-2 safety).
  - Run `pnpm prisma generate`.

- [ ] **Zod schemas** in new file `packages/core/src/schemas/canvas.ts`:
  - `cardSizeSchema` (z.enum: "compact" | "default" | "expanded").
  - `canvasViewportSchema` (`{ x: number, y: number, zoom: number, showEdges: boolean, cardSize: CardSize }`).
  - `canvasNodeSchema` (`{ id?, contextEntryId, x, y, w?, h?, excalidrawElementId }`).
  - `excalidrawSceneSchema` — loose: `{ elements: z.array(z.record(z.string(), z.unknown())), appState: z.record(z.string(), z.unknown()), files: z.record(z.string(), z.unknown()).optional() }` — Excalidraw's full element typing is too large to mirror.
  - `createCanvasLayoutSchema` (`{ name (1-200), slug? }`).
  - `updateCanvasLayoutSchema` (`createCanvasLayoutSchema.partial()` + viewport? + canvas?).
  - `upsertCanvasNodesBodySchema` (`{ upsert: canvasNodeSchema[], remove: string[] }` with size caps; ≤ 500 upserts per call).
  - `canvasImportBodySchema` (`{ format: "excalidraw" | "tldr", mode: "replace" | "merge" }`; file binary in multipart, validated server-side).
  - `setNodePositionSchema` (`{ layoutId, contextEntryId, x, y, w?, h? }`).
  - `createAnnotationSchema` (`{ layoutId, kind, geometry: { x, y, w?, h?, points? }, content? }`).
  - `getCanvasLayoutQuerySchema` (`{ layoutId? }`).
  - Re-export from `packages/core/src/schemas/index.ts`.
  - Re-export everything from `apps/web/lib/validations.ts`.

- [ ] **Delegate** SQL audit to `ascend-migration-auditor`. Verify: `search_vector` untouched, additive only, CHECK constraints present, indexes correct, CASCADE FKs correct. Block on any FAIL.

- [ ] **`/ax:cross-platform-check`** to confirm new schemas in `@ascend/core` have no banned imports.

- [ ] **`/ax:test`** — typecheck + build pass.

- [ ] **Commit**: `feat(db): Wave 9 Phase 1 — canvas schema + 3 migrations + Zod surface`.

## Phase 2: Service layer

- [ ] **`apps/web/lib/services/canvas-layout-service.ts` (new)**:
  - Const-object with `userId` + `workspaceId` as the first two args (matches Wave 8 services).
  - `list(userId, workspaceId)` — userId+workspaceId-scoped findMany, ordered by `updatedAt DESC`. Selects fields EXCLUDING `canvas` (the blob; keeps list responses small).
  - `getById(userId, workspaceId, id)` — selects everything including `canvas`. Includes `nodes`.
  - `getBySlug(userId, workspaceId, slug)` — same but by slug.
  - `getDefault(userId, workspaceId)` — finds the user's default; if none, creates one transactionally (`prisma.$transaction` with the WorkspaceMembership pre-check + Layout create + ActivityEvent `CANVAS_LAYOUT_CREATED`).
  - `create(userId, workspaceId, input)` — calls `permissionService.assertCanPerform(... "WRITE_NODE")`. Auto-derives `slug` from name if missing (lowercase, hyphens, unique check loop). Returns the created layout with empty nodes array.
  - `update(userId, workspaceId, id, input)` — permission check. Pre-flight: if `input.canvas` present, validate `JSON.stringify(input.canvas).length <= 2 * 1024 * 1024` and reject with clear error if over. Pre-flight: if `input.viewport` present, validate size cap. Updates and returns the layout.
  - `delete(userId, workspaceId, id)` — permission check. Verifies it's not the only layout for the user in the workspace (refuses). CASCADE handles CanvasNode rows. Fires `ActivityEvent` `CANVAS_LAYOUT_DELETED` (NEW enum value, add in Phase 1 if missing — TBD: add to the migration in Phase 1).
  - Every Prisma query includes `userId AND workspaceId` per safety rule 1 + Wave 8 DZ-22.

- [ ] **`apps/web/lib/services/canvas-node-service.ts` (new)**:
  - `listForLayout(userId, workspaceId, layoutId)` — verifies layout ownership via `canvasLayout.findFirst({ where: { id, userId, workspaceId } })` first, then returns all nodes.
  - `upsert(userId, workspaceId, layoutId, contextEntryId, position)` — verifies layout AND entry ownership, then upserts on `@@unique([canvasLayoutId, contextEntryId])`.
  - `bulkUpsert(userId, workspaceId, layoutId, ops)` — verifies layout ownership. For up to 500 ops in one call: validate each `contextEntryId` belongs to user+workspace via a bulk `findMany`. Then runs an `INSERT ... ON CONFLICT` per row inside a single transaction (use Prisma's transactional batch). Per-call writes capped at 500 per the Zod schema's array cap.
  - `removeFromLayout(userId, workspaceId, layoutId, contextEntryId)` — verifies ownership, deletes the CanvasNode row. Fires `ActivityEvent` `CANVAS_NODE_REMOVED`.
  - `removeMany(userId, workspaceId, layoutId, contextEntryIds[])` — for the bulk delete path.
  - **No NodeVersion snapshot trigger.** Add inline comment: `// no scheduleSnapshot — canvas position is layout metadata, not content (Wave 9 PRD)`.

- [ ] **`apps/web/lib/services/canvas-import-service.ts` (new)**:
  - `parseExcalidrawFile(buffer): { elements, appState, files }` — parses `.excalidraw` JSON. Validates shape (`type === "excalidraw"`, version field), validates element count ≤ 5000, validates total `JSON.stringify` size ≤ 4 MiB pre-import. Throws structured errors for parse failures.
  - **`parseTldrFile` removed from scope per Phase 0 spike.** Server-side import route accepts ONLY `format: "excalidraw"`; passing any other format value returns 400.
  - Pure parsing functions. No DB writes.

- [ ] **`ActivityEventType` enum additions** in `apps/web/prisma/schema.prisma`:
  - `CANVAS_LAYOUT_CREATED`, `CANVAS_LAYOUT_DELETED`, `CANVAS_NODE_ADDED`, `CANVAS_NODE_REMOVED`.
  - Hand-write the migration `20260514000004_add_canvas_activity_events/migration.sql`.
  - Update `apps/web/lib/services/activity-event-service.ts` payload types (the discriminated union by eventType).

- [ ] **Use `apps/web/lib/services/workspace-service.ts` as the structural template** for the layout service (workspace-scoped service pattern). Use `apps/web/lib/services/database-relation-service.ts.diffAndApply` as the template for the bulk-upsert raw-SQL pattern.

- [ ] **Delegate `ascend-reviewer`** for safety-rule sweep on the new services. Specifically verify: every query has both `userId` AND `workspaceId` filters, `permissionService.assertCanPerform` is called on every write path.

- [ ] **`/ax:test`** + `/ax:review`.

- [ ] **Commit**: `feat(services): Wave 9 Phase 2 — canvas-layout + canvas-node + canvas-import services`.

## Phase 3: API routes + React Query hooks

- [ ] **API routes** in `apps/web/app/api/canvas/`:
  - `layouts/route.ts` — `GET` (list) + `POST` (create).
  - `layouts/[id]/route.ts` — `GET` (detail) + `PATCH` (update) + `DELETE`.
  - `layouts/[id]/nodes/route.ts` — `POST` (bulk upsert/remove).
  - `layouts/[id]/nodes/[contextEntryId]/route.ts` — `DELETE` (convenience).
  - `import/route.ts` — `POST` (multipart). Parse `request.formData()`. Validate file size ≤ 100 MiB (matches Wave 0 file pipeline). Read buffer, call `canvasImportService.parseExcalidrawFile` or `parseTldrFile`, then `canvasLayoutService.update` with the parsed scene. Use the existing 100 MiB body-size pattern from `apps/web/app/api/files/presign/route.ts`.

- [ ] **All routes follow the auth-parse-service-respond pattern** in `.claude/rules/api-route-patterns.md`. Use `authenticate` from `apps/web/lib/auth.ts`. Use `handleApiError` in catch. Permission gates via `permissionService.assertCanPerform`.

- [ ] **Cache keys** in `apps/web/lib/queries/keys.ts`:
  ```ts
  canvas: {
    all: () => ["canvas"] as const,
    layouts: () => [...keys.canvas.all(), "layouts"] as const,
    layout: (id: string | null) => [...keys.canvas.all(), "layout", id ?? null] as const,
    nodes: (layoutId: string) => [...keys.canvas.all(), "nodes", layoutId] as const,
  },
  ```

- [ ] **`apps/web/lib/hooks/use-canvas.ts` (new)**:
  - `useCanvasLayouts()` — `useQuery`, 30s staleTime.
  - `useCanvasLayout(id: string | null)` — `useQuery` against `GET /api/canvas/layouts/[id]`, `enabled: !!id`, 30s staleTime.
  - `useCreateLayout()` — `useMutation`. `onSuccess`: invalidate `keys.canvas.layouts()` + `keys.activity.all()`. Toast.
  - `useUpdateLayout()` — `useMutation`. `onSuccess`: invalidate `keys.canvas.layout(id)`. Skip `layouts()` invalidation (the list endpoint excludes the `canvas` blob; opportunistic refetch on next list mount is sufficient).
  - `useDeleteLayout()` — `useMutation`. `onSuccess`: invalidate `keys.canvas.layouts()` + remove `keys.canvas.layout(id)` from cache + `keys.activity.all()`.
  - `useUpsertNodes()` — `useMutation`. `onSuccess`: invalidate `keys.canvas.layout(layoutId)` + `keys.activity.all()`.
  - `useRemoveNode()` — same.
  - `useImportFile()` — `useMutation` with multipart body. `onSuccess`: invalidate `keys.canvas.layout(layoutId)`.

- [ ] **Extend `useCreateContextLink` / `useDeleteContextLink`** in `apps/web/lib/hooks/use-context.ts` to ALSO invalidate `keys.canvas.layout(*)` (broad invalidation; one layout per user typical so the impact is small).

- [ ] **Use `apps/web/lib/hooks/use-workspaces.ts` + `apps/web/lib/hooks/use-database-rows.ts` as the structural templates**.

- [ ] **Delegate `ascend-security`** for the route audit. Verify: every route does `authenticate()` first, every Prisma path through the service includes `userId AND workspaceId`, the import route's multipart parsing enforces a 100 MiB size cap and bails before parsing huge files.

- [ ] **`/ax:test`** + `/ax:review`.

- [ ] **Commit**: `feat(api): Wave 9 Phase 3 — 7 canvas routes + use-canvas hooks`.

## Phase 4: View switcher + canvas mount + empty state

- [ ] **`apps/web/lib/stores/ui-store.ts`**:
  - Extend `ContextViewType` union with `"canvas"`.
  - Add persisted `canvasActiveLayoutId: string | null`.
  - Add transient `canvasLinkTypePickerOpen: { fromEntryId: string; toEntryId: string; pendingArrowId: string } | null`.
  - Add setter `setCanvasActiveLayoutId(id)` and `openCanvasLinkTypePicker(args)` / `closeCanvasLinkTypePicker()`.

- [ ] **`apps/web/components/context/context-view-switcher.tsx`** — add `{ value: "canvas", label: "Map", icon: Map }` to `VIEW_OPTIONS` (icon from `lucide-react`).

- [ ] **`apps/web/app/(app)/context/page.tsx`**:
  - Extend the switch on `contextActiveView` at line ~315 with `case "canvas":` that mounts `<ContextCanvasView />` (loaded via `next/dynamic({ ssr: false, loading: () => <CanvasLoadingSkeleton /> })`).
  - When `contextActiveView === "canvas"`, treat the layout similarly to graph view (`isGraphView` at line 278): full-bleed canvas area, narrow rail for entry detail when a card is clicked (Phase 6).
  - Re-use the existing two-panel structure where the right panel shows the selected entry's detail.

- [ ] **`apps/web/components/context/canvas/index.ts`** — barrel re-export for the canvas folder.

- [ ] **`apps/web/components/context/canvas/context-canvas-view.tsx` (new)**:
  - Dynamic-import `@excalidraw/excalidraw` and its CSS.
  - On mount: read `useUIStore.canvasActiveLayoutId`. If null, call `useCanvasLayouts()` and pick the default; if no default exists, call `useCanvasLayout()` with `?ensureDefault=true` (the layout service's `getDefault` handles lazy creation).
  - Render `<Excalidraw initialData={layout.canvas} viewModeEnabled={isReadOnly} onChange={handleOnChange} excalidrawAPI={(api) => { excalidrawAPI.current = api; }} />`.
  - Empty state when `nodes.length === 0` + `elements.length === 0`: `<ContextCanvasEmptyState />` overlay.
  - Loading skeleton during dynamic import + initial fetch.
  - Time-travel banner when Wave 7's `graphViewAtDate` is set: read-only mode + banner.

- [ ] **`apps/web/components/context/canvas/context-canvas-empty-state.tsx` (new)** — centered card with "Drag entries from the sidebar to start" + `⌘K` hint + button "Quick-add 5 recent entries" that calls `useUpsertNodes` with the 5 most-recently-updated entries laid out in a row.

- [ ] **`apps/web/components/context/canvas/canvas-loading-skeleton.tsx` (new)** — placeholder during dynamic import.

- [ ] **Delegate `ascend-ux`** for visual review: switcher icon contrast, canvas mount layout vs graph view, empty state visual hierarchy.

- [ ] **`/ax:verify-ui`** scenario: open `/context`, click Map button, confirm view switches, confirm empty state, confirm view persists across reload.

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(ui): Wave 9 Phase 4 — Map view switcher + canvas mount + empty state`.

## Phase 5: Node cards + drag-from-sidebar + autosave

- [ ] **`apps/web/components/context/canvas/canvas-card-overlay.tsx` (new)**:
  - For each `CanvasNode` in the active layout, render an absolutely-positioned `<div>` whose `style.transform: translate(x, y) scale(zoom)` is computed from the Excalidraw rectangle's coords + the canvas's `scrollX/Y/zoom` (read from `excalidrawAPI.getAppState()` every animation frame via `requestAnimationFrame`).
  - Use `useDeferredValue` for the appState reads to keep the overlay fluid under heavy interaction.
  - Card content: type badge (using `apps/web/components/context/context-type-select.tsx`'s color palette), title, 2-line preview, outgoing-link count, tags (top 3).
  - On click: opens the entry detail in the right rail by setting `useUIStore.selectedContextEntryId`.

- [ ] **`apps/web/components/context/canvas/canvas-card-size-toggle.tsx` (new)** — three icon-buttons in the toolbar that switch `viewport.cardSize`. Updates the layout via `useUpdateLayout`.

- [ ] **Drag-from-sidebar wiring**:
  - `apps/web/components/context/context-entry-list.tsx` — make each `<li>` draggable with `draggable onDragStart={(e) => e.dataTransfer.setData("application/x-ascend-entry", JSON.stringify({ id }))}`.
  - `apps/web/components/context/context-category-tree.tsx` — same for tree rows.
  - `context-canvas-view.tsx` — `onDragOver={e => e.preventDefault()}` + `onDrop` handler that reads the transfer, computes the drop position in canvas coords (subtract scroll, divide by zoom), and calls `useUpsertNodes` with one upsert at that position. Excalidraw rectangle is created via `excalidrawAPI.updateScene({ elements: [...current, newRect] })`.

- [ ] **Autosave**:
  - `apps/web/lib/hooks/use-canvas-autosave.ts` (new) — a hook that:
    - Subscribes to Excalidraw `onChange` (fires on every scene change).
    - Maintains a `useRef<NodeJS.Timeout | null>` debounce timer (1.5s).
    - On timeout fire: call `useUpdateLayout` with `{ canvas: { elements, appState, files } }`. After a successful save, also derive any new/moved/removed CanvasNode positions from the new scene and call `useUpsertNodes`.
    - On `window.beforeunload` and editor blur: flush immediately.
    - Exposes `status: "idle" | "saving" | "saved" | "failed"` for the toolbar pill.
    - Content-hash dedup at the service layer (Phase 2's update method) handles the no-op-edit case.

- [ ] **`apps/web/components/context/canvas/canvas-save-status.tsx` (new)** — toolbar pill showing the autosave status. "Saved 3s ago" / "Saving..." / "Save failed — Retry" (button calls `flushAutosave` again).

- [ ] **Delegate `ascend-ux`** for visual review on card overlay sync, card hover/focus states, drag-drop drop indicator, save status pill.

- [ ] **`/ax:verify-ui`** scenario: drag 3 entries onto canvas, confirm cards appear, confirm autosave pill goes "Saving..." → "Saved", reload, confirm cards persist.

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(ui): Wave 9 Phase 5 — canvas cards + drag-from-sidebar + autosave`.

## Phase 6: Edge rendering + creation + type picker

- [ ] **`apps/web/components/context/canvas/canvas-edge-sync.ts` (new helper, not a component)**:
  - `computeEdgeElements(links, canvasNodes, showEdges): ExcalidrawArrowElement[]` — for each `ContextLink` whose endpoints both exist as `CanvasNode` rows in the active layout, builds an Excalidraw arrow element with `customData.kind: "edge"` + `customData.linkId` + `customData.linkType` + `startBinding` + `endBinding`. When `showEdges === false`, sets `opacity: 0` and `locked: true`.
  - `diffArrows(prevElements, nextElements): { newArrows: Element[], removedArrowIds: string[] }` — detects arrows added or removed in `onChange`.

- [ ] **`context-canvas-view.tsx` extensions**:
  - On layout load + `ContextLinks` fetched: merge the edge elements into the scene via `excalidrawAPI.updateScene`.
  - In `handleOnChange`: call `diffArrows`. For each NEW arrow whose both endpoints bind to elements with `customData.kind === "node-card"` AND lacks a `customData.linkId`: open the link-type picker (set `useUIStore.openCanvasLinkTypePicker({ fromEntryId, toEntryId, pendingArrowId: arrow.id })`).
  - For each removed arrow that had a `customData.linkId`: call `useDeleteContextLink({ id: customData.linkId })`.

- [ ] **`apps/web/components/context/canvas/canvas-link-type-picker.tsx` (new)**:
  - Mounted at the canvas root; reads `useUIStore.canvasLinkTypePickerOpen`.
  - Modal with 6 type options (REFERENCES, MENTIONS, RELATES_TO, CONTRADICTS, SUPPORTS, DEPENDS_ON — per PRD Open Question 3 resolution). Each option shows its arrow color from `@ascend/graph.edgeColor`.
  - On confirm: `useCreateContextLink.mutateAsync({ fromEntryId, toEntryId, type, source: "CANVAS" })`. On success, tag the pending arrow with `customData.linkId` and `customData.linkType` via `excalidrawAPI.updateScene`. Close modal.
  - On cancel or Escape: remove the pending arrow from the scene.

- [ ] **`apps/web/components/context/canvas/canvas-edge-toggle.tsx` (new)** — toolbar toggle button that flips `viewport.showEdges` and triggers a scene update that hides/shows all `customData.kind === "edge"` arrows.

- [ ] **Type assertion: `useCreateContextLink` accepts `source: "CANVAS"`** — verify in `apps/web/lib/hooks/use-context.ts` that the create mutation already accepts the new `CANVAS` enum value; if it has narrowing on the schema, widen.

- [ ] **Cross-domain cache invalidation verified**: edge create from canvas invalidates context links + context graph + canvas layout (via the Phase 3 extension on the link hooks).

- [ ] **Delegate `ascend-ux`** for visual review on type-picker modal layout + edge color clarity + arrow rendering.

- [ ] **`/ax:verify-ui`** scenario: draw an arrow between two cards → type picker appears → pick "REFERENCES" → arrow gets the right color → switch to Graph view → confirm the new edge appears there too.

- [ ] **`/ax:test`** + `/ax:review`.

- [ ] **Commit**: `feat(ui): Wave 9 Phase 6 — canvas edge rendering + creation flow + 6-option type picker`.

## Phase 7: Multiple layouts + switcher + rename

- [ ] **`apps/web/components/context/canvas/canvas-layout-switcher.tsx` (new)** — toolbar dropdown listing the user's layouts (from `useCanvasLayouts`). Each row: name + node count + kebab. Click row → set `useUIStore.canvasActiveLayoutId`. "+ New layout" footer item → opens an inline input → calls `useCreateLayout`.

- [ ] **`apps/web/components/context/canvas/canvas-layout-rename-dialog.tsx` (new)** — opened from the kebab menu. Input pre-filled with the layout name. Save → `useUpdateLayout({ name })`.

- [ ] **Layout delete from kebab**: confirmation dialog ("Delete layout 'Personal'? This removes the canvas annotations and node positions, but does NOT delete the underlying notes."). On confirm → `useDeleteLayout`. The default layout cannot be deleted if it's the only one (server returns 400 with clear error; surface in the dialog).

- [ ] **Active layout persistence**: `useUIStore.canvasActiveLayoutId` is persisted, so refresh restores. On first-ever visit when no layouts exist, the service's `getDefault` creates "Personal" lazily; the hook awaits and sets the active id.

- [ ] **`/ax:verify-ui`** scenario: create 2 layouts → switch between them → confirm node sets differ → rename one → confirm the dropdown updates.

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(ui): Wave 9 Phase 7 — multiple layouts + switcher + rename + delete`.

## Phase 8: Import + export

- [ ] **`apps/web/components/context/canvas/canvas-import-dialog.tsx` (new)** — file picker (accept `.excalidraw` only). If user attempts to drop a `.tldr` file, the dialog shows an inline message: "Tldraw (.tldr) import is not supported. Please export your tldraw drawing to .excalidraw first." with a `<a href="https://tldraw.dev/docs/file-format">` help link. On `.excalidraw` selection: show preview ("12 elements detected") + radio for `replace` vs `merge`. Confirm → uploads via `useImportFile`.

- [ ] **Server-side parsing in `apps/web/app/api/canvas/import/route.ts`**:
  - Parse `request.formData()`. Read the file as ArrayBuffer.
  - Validate `format === "excalidraw"`. Reject other formats with 400 "Only .excalidraw is supported. See PRD Phase 0 spike."
  - Call `canvasImportService.parseExcalidrawFile(buffer)`.
  - On `mode: "replace"` → overwrite the layout's `canvas` field.
  - On `mode: "merge"` → fetch current canvas, concat `elements`, dedupe by id, write back.
  - Return updated layout + parsed warnings.

- [ ] **Export button** — toolbar action that calls `excalidrawAPI.getSceneElementsIncludingDeleted()` + `excalidrawAPI.getAppState()` + `excalidrawAPI.getFiles()` and triggers a browser download of `<layout-slug>.excalidraw`. Uses Excalidraw's `serializeAsJSON` helper.

- [ ] **Delegate `ascend-security`** for the import route audit: verify multipart size cap is enforced BEFORE buffering the full file, parse-validate before any DB write, no `eval` / `Function` constructor / unsafe deserialization.

- [ ] **`/ax:verify-ui`** scenario: export current layout, modify the file slightly, re-import in "replace" mode, confirm scene updates.

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(ui): Wave 9 Phase 8 — canvas import (.excalidraw) + export`.

## Phase 9: MCP tools

- [ ] **JSON Schema** in `apps/web/lib/mcp/schemas.ts` — append to `TOOL_DEFINITIONS`:
  - `get_canvas_layout` — params: `layoutId?` (string, optional; defaults to user's default).
  - `set_node_position` — params: `layoutId` (string), `contextEntryId` (string), `x` (number), `y` (number), `w?` (number), `h?` (number).
  - `create_annotation` — params: `layoutId` (string), `kind` (enum: `"freehand" | "rectangle" | "ellipse" | "text" | "sticky" | "frame"`), `geometry` (object: `{ x, y, w?, h?, points? }`), `content?` (string for text/sticky).

- [ ] **Handler file** `apps/web/lib/mcp/tools/canvas-tools.ts` (new):
  - `handleCanvasTool(userId, workspaceId, name, args): Promise<McpContent>`.
  - Switch on name:
    - `get_canvas_layout` → `canvasLayoutService.getDefault(userId, workspaceId)` (when no layoutId) or `getById(userId, workspaceId, layoutId)`; returns `{ layout, nodes }`.
    - `set_node_position` → `canvasNodeService.upsert(userId, workspaceId, layoutId, contextEntryId, { x, y, w, h })`. Also updates the corresponding rectangle in the layout's Excalidraw scene blob (`canvasLayoutService.update` with new canvas).
    - `create_annotation` → reads the layout's canvas blob, appends a new Excalidraw element with the given kind + geometry + `customData.kind: "annotation"`, persists via `canvasLayoutService.update`.
  - Each case Zod-validates `args` via the corresponding schema imported from `lib/validations.ts`.
  - Returns `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`.
  - Error handling per `.claude/rules/mcp-tool-patterns.md`.

- [ ] **Routing** in `apps/web/lib/mcp/server.ts`:
  - Add `CANVAS_TOOL_NAMES = new Set(["get_canvas_layout", "set_node_position", "create_annotation"])`.
  - In the `CallToolRequestSchema` handler, add: `if (CANVAS_TOOL_NAMES.has(name)) return handleCanvasTool(userId, workspaceId, name, args ?? {});`.

- [ ] **Tool count verification**: post-deploy `curl /api/mcp tools/list` should report **79 tools** (76 + 3).

- [ ] **`/ax:test`**.

- [ ] **Commit**: `feat(mcp): Wave 9 Phase 9 — 3 canvas MCP tools (76 → 79)`.

## Phase 10: Time-travel banner + activity events + delight

- [ ] **Time-travel compatibility**: `context-canvas-view.tsx` reads `useUIStore.graphViewAtDate`. When set (non-null), passes `viewModeEnabled={true}` to Excalidraw AND mounts a top-of-canvas banner: "Map view shows current state only. To time-travel, switch to Graph view." with a "Return to now" pill (clears `graphViewAtDate`).

- [ ] **Activity event rendering**: extend `apps/web/components/activity/activity-event-row.tsx` to render verbs for the 4 new event types:
  - `CANVAS_LAYOUT_CREATED` → "created a canvas layout «X»".
  - `CANVAS_LAYOUT_DELETED` → "deleted a canvas layout «X»".
  - `CANVAS_NODE_ADDED` → "added «entry title» to canvas «layout name»".
  - `CANVAS_NODE_REMOVED` → "removed «entry title» from canvas «layout name»".
  - Each verb links to `/context?id=<contextEntryId>&view=canvas&layoutId=<layoutId>` (Wave 8b's deep-linking pattern).

- [ ] **Filter UI**: add a "Canvas" filter group to `apps/web/components/activity/activity-feed-view.tsx` filter sidebar with the 4 new types.

- [ ] **Confetti on first layout creation**: `useCreateLayout.onSuccess` fires `apps/web/lib/confetti.ts` `fireFirstRowConfetti` (or add `fireCanvasConfetti` with similar size). Reduced-motion-aware.

- [ ] **Polished empty state copy**: confirm copy with `ascend-ux` per PRD Open Question 5.

- [ ] **Card hover affordance**: when a card is hovered AND `showEdges === false`, briefly fade in the edges connected to that card so the user can preview connections. Reverts on un-hover. Reduced-motion-aware.

- [ ] **Delegate `ascend-ux`** for final polish: card hover state, banner styling, time-travel banner accessibility (aria-live polite).

- [ ] **`/ax:verify-ui`** scenario: full happy path including time-travel banner + confetti + activity events.

- [ ] **`/ax:test`** + `/ax:review`.

- [ ] **Commit**: `feat(ui): Wave 9 Phase 10 — time-travel banner + activity events + delight polish`.

## Phase 11: Wave close

- [ ] **`/ax:critique`** — launch `ascend-critic` for product quality verdict. Compare against Notion (canvas blocks), Obsidian (canvas plugin), and Arc (spatial tabs). Required: GOOD or WORLD-CLASS. NEEDS WORK or NOT READY blocks close.

- [ ] **Run `ascend-reviewer`** cumulative mode against the full Wave 9 diff. Address any blocking findings.

- [ ] **Run `ascend-security`** audit on Wave 9 routes (7 user-facing routes + 0 cron). Verify userId+workspaceId scoping, multipart import size guard, permission gates on every mutation.

- [ ] **Run `ascend-migration-auditor`** on the 4 migrations. Verify additive, search_vector untouched, CHECK constraints applied, FKs CASCADE correct.

- [ ] **Address all blocking critic must-fixes** before close.

- [ ] **Update `CLAUDE.md`**:
  - **Architecture subsection: "Spatial canvas (Wave 9)"** — describe CanvasLayout, CanvasNode tables; the 3 canvas services; the Excalidraw integration; the canvas-edge sync model; the 3 MCP tools.
  - **Entity Model rows**: CanvasLayout, CanvasNode.
  - **Views table row**: "Map view (Wave 9)" pointing to `components/context/canvas/context-canvas-view.tsx`.
  - **Key File Lookup entries** (~10 new): canvas services, hook file, view + toolbar + cards + edge sync + import + MCP handler.
  - **Danger Zones**: DZ-25 (canvas blob runaway), DZ-26 (edge creation noise).
  - **MCP Server section**: tool count 76 → 79; list the 3 new tools.

- [ ] **Update `.ascendflow/BACKLOG.md`** with Wave 9 ship summary + carry-overs (realtime canvas collab, canvas time-travel, mobile canvas, embedded canvases inside notes, AI-generated layouts, per-link annotations, snap-to-grid, layout sharing).

- [ ] **Write `CLOSE-OUT.md`** at `.ascendflow/features/context-v2/wave-9-spatial-canvas/CLOSE-OUT.md` per the Wave 8 template:
  - Success criteria audit (every checkbox: DONE / SKIPPED with reason / NOT DONE with reason).
  - Reviewer + critic + security audit results.
  - Pre-deploy checklist.
  - Wave 10 onramp (extensibility).
  - Manual smoke checklist (the 12-step list from PRD "Success Test").

- [ ] **Write reviewer + critic + security artifacts** to `.ascendflow/reviews/<date>-wave9-close.md`, `.ascendflow/critiques/<date>-wave9-close.md`, `.ascendflow/security/<date>-wave9-close.md`.

- [ ] **Manual prod smoke** (per PRD "Success Test"). Document results in CLOSE-OUT.md.

- [ ] **`/ax:wave-close 9`** — runs the strict completion ritual.

- [ ] **`/ax:deploy-check`** — pre-push gate.

- [ ] **Commit**: `chore(wave-9): close Wave 9 — spatial canvas shipped`.

## Verification phase (already covered by Phase 11 above)

- [ ] `npx tsc --noEmit` — must pass.
- [ ] `pnpm build` — must pass.
- [ ] `/ax:review` — must pass with all blocking findings addressed.
- [ ] `/ax:verify-ui` — must pass with scenarios in Phases 4, 5, 6, 7, 8, 10.
- [ ] `/ax:critique` — must return GOOD or WORLD-CLASS.
- [ ] `/ax:cross-platform-check` — must pass after Phase 1 (the canvas schemas in `@ascend/core`).
- [ ] `/ax:wave-close 9` — strict close ritual must pass.
- [ ] `/ax:deploy-check` — pre-push gate must pass.
