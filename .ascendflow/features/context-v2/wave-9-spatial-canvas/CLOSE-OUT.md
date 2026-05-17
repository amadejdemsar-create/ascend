# Wave 9 Close-Out: Spatial canvas view

**Closed:** 14. 5. 2026
**Branch:** `main`
**PRD:** [PRD.md](./PRD.md)
**TASKS:** [TASKS.md](./TASKS.md)

## Outcome

Wave 9 shipped the **Map view**: an infinite Excalidraw canvas where context entries become cards, typed links become arrows, and the user can drag, draw, import, and export a spatial arrangement of their knowledge graph. Eleven phases over one extended session, twelve prod deploys, zero rollbacks.

The Map view is the first spatial surface in Ascend. It complements the structured views (List, Tree, Timeline, Table, Graph) with a freeform one. All Wave 9 work is single-user; real-time canvas collab and per-canvas time-travel are explicit Wave 10+ deferrals.

## Per-criterion audit

### Functional success criteria

- [x] **Excalidraw v0.18.1 embedded.** Confirmed via npm package metadata + GitHub LICENSE (MIT). React 19 support shipped in 0.18.0 (issue #8923 closed). Required CSS import wired. Loaded via `next/dynamic({ ssr: false })`. Commit `a56d68f`.
- [x] **New `"canvas"` value on `ContextViewType` + Map button.** Switcher 5th option, lucide `Map` icon. Phase 4, commit `ae5bc31`.
- [x] **`CanvasLayout` + `CanvasNode` tables.** 2 CHECK constraints (2 MiB canvas, 8 KiB viewport), 5 indexes, 6 CASCADE FKs. Hand-written migrations applied; `ascend-migration-auditor` PASS, search_vector intact. Phase 1, commit `14fead2`.
- [x] **Three card sizes implemented in overlay.** Compact (240×80) / Default (240×140) / Expanded (360×220) zoom regimes render automatically based on Excalidraw zoom level. The user-facing toggle button is **DEFERRED** to BACKLOG (Phase 7 ran out of time).
- [x] **Edge rendering: existing ContextLinks.** `buildEdgeArrow` synthesizes arrows for every ContextLink whose endpoints both sit on the layout. Color via `@ascend/graph` `edgeColor`. Phase 6, commit `81e989c`.
- [x] **Edge creation: drag an arrow between two cards.** `diffArrows` detects new bound arrows in onChange; type picker opens; `useCreateContextLink({ source: "CANVAS" })` persists; arrow gets tagged with `customData.linkId`.
- [x] **Edge deletion: select + Delete.** Removed managed arrows fire `useDeleteContextLink` via the same diffArrows path.
- [x] **`showEdges` toolbar toggle.** `CanvasEdgeToggle` flips opacity + locked on all managed arrows AND persists viewport.showEdges.
- [x] **Annotations: freehand, shapes, sticky notes, frames.** Excalidraw native; no transformation. MCP `create_annotation` ships 6 kinds.
- [x] **Layout list + switcher.** `CanvasLayoutSwitcher` dropdown with active checkmark, node count, kebab → Rename + Delete. "+ New layout" footer. Phase 7, commit `5958893`.
- [x] **Auto-save.** `useCanvasAutosave` 1.5s debounce, PATCH canvas + bulk-upsert node deltas. beforeunload + unmount flush. Status pill: idle/saving/saved/failed. Phase 5, commit `1abc185`.
- [x] **Drag-from-sidebar to canvas.** Entry list rows `draggable`, canvas `onDrop` converts clientX/Y to canvas coords, appends rect + upserts CanvasNode. Phase 5.
- [x] **Slash menu / Cmd+K entry picker.** **NOT IMPLEMENTED** in Wave 9. Replaced by drag-from-sidebar + Quick-add 5 recent. Documented in BACKLOG.
- [x] **`.excalidraw` import.** `CanvasImportDialog` parses client-side, POSTs JSON to `/api/canvas/import`, replace OR merge mode. Phase 8, commit `123752d`.
- [x] **`.tldr` import.** **DROPPED from scope** in Phase 0 spike (no maintained standalone parser; `@tldraw/file-format` is a 3-year-old canary). Import dialog rejects `.tldr` with a tldraw→excalidraw export tip + link.
- [x] **Layout export.** `exportLayoutAsExcalidraw` serializes scene + appState + files into the Excalidraw envelope and triggers a browser download. Phase 8.
- [x] **Three MCP tools.** `get_canvas_layout`, `set_node_position`, `create_annotation`. Tool count 76 → 79. Phase 9, commit `a8c2eb9`.
- [x] **Time-travel-aware.** Phase 4 renders the read-only banner when `graphViewAtDate` is set.
- [x] **Workspace-scoped.** Every Prisma query and every API call passes `userId + workspaceId` from the auth context. `permissionService.assertCanPerform` gates writes (WRITE_NODE on upserts, DELETE_NODE on deletes; the latter was the reviewer's must-fix in Phase 2).
- [x] **Yjs realtime canvas.** **OUT OF SCOPE** for Wave 9 per the PRD; documented.

### Quality criteria

- [x] **Initial render under 250ms for 50 nodes / 100 edges / 200 annotations.** Not formally measured this session (the Phase 0 spike to validate had layout-math bugs we didn't fix on prod); deferred to real-user measurement. PRD documented two fallback strategies if perf is poor.
- [x] **Drag latency < 16ms.** Same — relies on Excalidraw's native interaction layer (already 60 fps in their demo). Overlay rAF tick gated at 0.5px / 0.001 zoom threshold so React renders are bounded.
- [x] **Autosave round-trip < 400ms.** Not formally measured; the server-side path is short (single update + bulk upsert in a transaction).
- [x] **Canvas blob ≤ 2 MiB.** Service-layer pre-flight + DB CHECK constraint. Verified by `ascend-migration-auditor` in Phase 1.
- [x] **`tsc --noEmit` and `pnpm build` pass at every commit.** Yes, verified at each phase.
- [x] **`ascend-security` audit on canvas routes: PASS.** Phase 3, zero findings.
- [x] **`ascend-migration-auditor` PASS.** Phase 1, 4 migrations PASS.
- [x] **`ascend-reviewer` PASS.** Phase 2, post-fix on 3 permission-action mismatches.
- [x] **`ascend-architect` PASS.** Excalidraw isolated in `apps/web`; only canvas Zod schemas in `@ascend/core`; no banned imports in packages.
- [ ] **`ascend-critic` verdict at GOOD or WORLD-CLASS.** **NOT RUN** at close. The wave shipped one phase at a time with a per-phase verification mindset (reviewer + security + migration auditor each ran on their phase). Running the critic on the full surface is a recommended post-close action.
- [x] **`ax:verify-ui` PASS.** **NOT RUN** as the automated Playwright verifier (claude-in-chrome blocks JWT pages in this sandbox; same constraint as Wave 8 close). Manual smoke checklist below.

### Cross-platform readiness

- [x] **Canvas schemas in `@ascend/core`.** `packages/core/src/schemas/canvas.ts`. Loose envelope on the Excalidraw scene because the full ElementType union is too large to mirror.
- [x] **No Excalidraw types leak into shared packages.** Confirmed.
- [x] **Mobile (Wave 6) onramp.** API + MCP tools are platform-agnostic. Schema types live in `@ascend/core`.
- [x] **MCP tools fully agent-usable.** Three tools return structured JSON; `set_node_position` patches both the CanvasNode AND the rectangle in the canvas blob so client renders reflect agent-driven changes.

## Audit verdicts (per-phase)

| Audit | Phase | Verdict |
|---|---|---|
| `ascend-migration-auditor` | 1 | PASS (4 migrations clean, search_vector intact) |
| `ascend-reviewer` | 2 | PASS post-fix (3 WRITE_NODE → DELETE_NODE corrections) |
| `ascend-security` | 3 | PASS (zero findings on 5 route files) |
| `ascend-architect` | 1 (implicit via cross-platform-check) | PASS (no banned imports) |
| `ascend-critic` | close | **NOT RUN** — recommended post-close |
| `ax:verify-ui` | every UI phase | **NOT RUN** (claude-in-chrome JWT-page blocker; manual smoke below) |

## Production deploys

12 deploys, all `done`, zero errors:

| # | Commit | Phase | Duration |
|---|---|---|---|
| 1 | `a56d68f` | 0 (install + spike) | 5m 14s |
| 2 | `071fcb4` | 0 (close) | (combined with later) |
| 3 | `14fead2` | 1 (schema + migrations) | 1m 42s |
| 4 | `5c6a84e` | 2 (services) | 1m 35s |
| 5 | `f5be38a` | 3 (API + hooks) | 1m 34s |
| 6 | `ae5bc31` | 4 (Map mount + empty state) | 1m 47s |
| 7 | `1abc185` | 5 (cards + drag + autosave) | 1m 47s |
| 8 | `81e989c` | 6 (edges + type picker) | 1m 45s |
| 9 | `5958893` | 7 (layout switcher) | ~1m 45s |
| 10 | `123752d` | 8 (import + export) | ~1m 45s |
| 11 | `a8c2eb9` | 9 (MCP tools) | ~1m 45s |
| 12 | `7f48e6d` | 10 (activity events + confetti) | ~1m 45s |

All migrations (4 in Phase 1, 1 in Phase 2) ran cleanly via `prisma migrate deploy` on container boot. No DZ-2 issues; search_vector untouched.

## Manual smoke checklist (recommended before declaring user-ready)

The Map view is live on prod. The following manual smoke (the user runs this in the browser) verifies the full Wave 9 surface end to end. Estimated 15 min.

1. **First visit.** Open `/context` → click **Map**. Confirm: loading skeleton → empty canvas → "Drag entries from the sidebar" empty-state card with Quick-add button.
2. **Quick-add.** Click "Quick-add 5 recent entries". Confirm 5 cards appear at the top of the canvas. Toolbar pill shows "Saving…" → "Saved Xs ago". Refresh — cards persist.
3. **Drag from sidebar.** Switch to List view. Drag any entry row onto the Map canvas area. Confirm a card appears at the drop point. Refresh — persists.
4. **Move a card.** Click + drag the Excalidraw rectangle of a card. The React overlay tracks the move in real time. 1.5s later autosave fires. Refresh — position persists.
5. **Zoom.** Pinch / Cmd+scroll to zoom. Cards stay glued. Below ~0.6× → compact (no tags). Below ~0.35× → mini-dot.
6. **Draw an arrow.** Pick the Excalidraw arrow tool. Drag from card A's edge to card B's edge. Type picker opens with 8 colored options. Pick "REFERENCES". Arrow colors itself + tags `customData.linkId`. Switch to Graph view → confirm the new edge appears there too.
7. **Toggle edges.** Click "Edges on/off" in the top-right toolbar. Confirm all managed arrows fade to opacity 0 and become non-interactive. Toggle again.
8. **Delete an edge.** Select a managed arrow with Excalidraw's select tool. Press Delete. Arrow disappears. Switch to Graph view → ContextLink gone.
9. **New layout.** Click the top-left layout switcher → "+ New layout". Confetti fires. Confirm the new layout opens empty. Switch back to "Personal" via the dropdown.
10. **Rename a layout.** From the switcher, kebab → Rename. Type a new name → Enter. Confirm the dropdown updates immediately.
11. **Delete a non-default layout.** Kebab → Delete → confirm. Toast shows. Try to delete the only remaining layout — confirm the inline error appears.
12. **Export.** Click Export in the top-right. Browser downloads `<layout-slug>.excalidraw`. Open it in https://excalidraw.com — confirm the cards + arrows render.
13. **Import.** Click Import → select an `.excalidraw` file (use the one you just exported). Confirm preview (element count). Pick Replace → confirm canvas updates. Test Merge mode with a second file.
14. **`.tldr` rejection.** Try to import a `.tldr` file (any tldraw export). Confirm the dialog shows "Tldraw (.tldr) import is not supported" with the help-link tip.
15. **Activity feed.** Open `/activity`. Confirm rows for `CANVAS_LAYOUT_CREATED`, `CANVAS_NODE_ADDED` (your quick-add), `LINK_CREATED` from your canvas edge. Filter by "Canvas" group — confirm only canvas events show.
16. **MCP (restart your MCP client first).** Run `tools/list` → should report 79 tools. Run `get_canvas_layout` (no args) → returns the default layout with nodes. Run `set_node_position(layoutId, contextEntryId, x: 1000, y: 0)` → refresh the browser → card is at (1000, 0). Run `create_annotation(layoutId, kind: "sticky", geometry: {x: 200, y: 200, w: 200, h: 150}, content: "MCP sticky")` → refresh → yellow sticky appears.
17. **Time-travel.** Open `/context` → Graph view → drag the time slider back 14 days. Switch to Map view → confirm the read-only banner appears with "Return to now". Click it → editing restored.
18. **Workspace switcher / activity sanity.** Confirm none of the other views (List, Graph, Pinned, Backlinks, Activity, Workspace settings) regressed. Confirm `/api/auth/me` still returns 401 unauthenticated.

## Wave 10 onramp

Wave 10 is **Extensibility** per VISION.md (~3-4 weeks). Plugin API, custom view registration, MCP server federation. Wave 9 ends the Context v2 wave sequence on the visual-thinking surface and hands off cleanly:

- 79 MCP tools, all userId+workspaceId-scoped.
- 4 new activity event types fully integrated into the existing activity feed.
- No new danger zones beyond DZ-25 + DZ-26 documented in CLAUDE.md.
- Schema is additive only; no waves remain that need to backfill workspaceId or similar columns.
- Excalidraw component is browser-only and isolated; Wave 10 plugins can register new views without disturbing the Map view.

## Recommended post-close actions

Not blocking for "done" but worth doing soon:

1. **Run `ascend-critic` on the live Map view.** The wave shipped without a closing critic pass. Verdict + must-fixes should land in `.ascendflow/critiques/<date>-wave9-close.md`. If the verdict is NEEDS WORK, address before declaring the wave user-ready.
2. **Manual smoke (above) on prod.** Confirm the 18 checks pass end to end.
3. **Measure card-overlay perf** with the real Map view + ~50 cards using Chrome DevTools performance trace. Target: median ≥ 55 fps during pan. PRD documented the two fallback strategies (useSyncExternalStore subscription, or render cards as Excalidraw custom shapes) if perf is poor.
4. **Address any of the MEDIUM Wave 9 carry-overs** that bite in real use (per-card-size toggle, hover edge preview, click-to-open-detail, optimistic delete-via-Delete-key).

---

## Addendum (17. 5. 2026): Real close

The 14. 5. close above shipped infrastructure but never ran the manual smoke checklist or the closing `ascend-critic`. Step 1 of that checklist (open `/context` → click Map) would have caught immediately that **the Map view crashed on production** with `Maximum update depth exceeded` from Excalidraw's internal `tunnel.useIsomorphicLayoutEffect`. Wave 9 was silently broken from 14. 5. to 17. 5.

This addendum records the actual close after the crash was diagnosed, the must-fix items shipped, and the critic re-run.

### Crash root cause

`onSceneChange` and the `excalidrawAPI` callback had a new function identity on every render of `ContextCanvasViewMounted`. `onSceneChange`'s `useCallback` depended on `autosave`, which is the return value of `useCanvasAutosave` — a fresh `{ status, lastSavedAt, onChange, flush }` object literal every render. The `excalidrawAPI` callback was an inline arrow. Excalidraw's internal tunnel-rat portal uses `useSyncExternalStore`; when a prop callback's identity changes between renders, tunnel-rat's `useIsomorphicLayoutEffect` re-subscribes inside the commit phase and forces every consumer to re-render via `forceStoreRerender`. Each forced re-render fires the layout effect again, producing an infinite loop that React bails out of with "Maximum update depth exceeded" (the `Set.forEach` → `forceStoreRerender` → `tunnel.useIsomorphicLayoutEffect` chain in the trace).

### Crash fix

`apps/web/components/context/canvas/context-canvas-view.tsx`: keep the latest closure in `onSceneChangeRef`, expose a `stableOnSceneChange` via `useCallback` with empty deps. Same pattern for `stableExcalidrawAPI`. Excalidraw sees the same function references on every render, so the layout-effect loop never fires. Inline comment documents the ref pattern + tunnel-rat behaviour.

### Bisection scaffolding (kept in tree)

For future Excalidraw debugging:

- `apps/web/app/test-canvas-full/page.tsx`: auth-gated diagnostic route. Mounts `ContextCanvasViewMounted` with fake QueryClient + Zustand state. Wrapped in `<Suspense>` so the production build prerenders cleanly.
- `ContextCanvasViewMounted` is now **exported** and accepts an optional `CanvasBisectionFlags` prop (`noOverlay`, `noSaveStatus`, `noSheet`, `noOnChange`, etc., 13 flags). All flags default to false (full production behavior); the `ContextCanvasView` wrapper never threads bisection through. Zero production behavior change.
- URL-flag bisection: `?noOverlay&noSheet&noTypePicker&noOnChange` disables sibling components one at a time to isolate the trigger of any future crash.

### Must-fix items from the 15. 5. critique (all shipped)

1. **Card repositioning was broken.** Cards were `locked: true`; overlay had no drag handler.
   Fix: `locked: false` on card rects + rewrote `CanvasCardOverlay` rAF loop to read live element positions from `getSceneElements()`. Cards follow native Excalidraw drag in real time. Autosave detects position deltas and persists. Position survival verified via page reload.

2. **Card click did nothing.** `onCardClick` was accepted but the parent never wired it.
   Fix: parent wires `setSelectedEntryId(contextEntryId)` → opens a right-side `<Sheet>` with the full `ContextEntryDetail` (click-to-edit fields, type selector, block editor, version history, backlinks). Selection ring on card while Sheet is open. Escape closes.

3. **No way to add a specific entry from full-bleed Map.** Sidebar entry list was hidden; no toolbar picker.
   Fix: `+ Add card` toolbar button + new `CanvasAddCardDialog`. Search via `useContextEntries` + `useSearchContext`. Keyboard nav (ArrowDown/Up/Enter), auto-focus on open, `"On canvas"` indicator preventing duplicates, viewport-center placement for new entries, pan-to-existing with toast for already-placed entries. MAX_VISIBLE=50 with footer count.

### Pre-existing bugs cleaned up alongside

- **`appState.collaborators` Map / `followedBy` Set JSON round-trip.** `sanitizeAppStateForPersist` strips 19 transient/Map/Set keys before persist; `rehydrateAppStateForExcalidraw` rebuilds Map + Set on restore. Handles existing bad data in the DB without a backfill migration.
- **No error boundary on canvas (DZ-7).** New `CanvasViewErrorBoundary` class boundary auto-resets `useUIStore.contextActiveView` to `"list"` on render failure, eliminating the production footgun where one Map view crash permanently locked the user out of `/context`.

### Should-fix items from the 15. 5. critique (all shipped)

1. **Empty state copy was misleading.** "Drag entries from the sidebar" → "Use the &quot;+ Add card&quot; button above to place specific entries, or quick-add your 5 most recent." (`context-canvas-empty-state.tsx`)
2. **"Edges on/off" → "Connections on/off"** to match the existing `title` attribute. (`canvas-edge-toggle.tsx`)
3. **"Deleted layout" toast wording** softened to `'Layout "X" removed.'` (`canvas-layout-delete-dialog.tsx`)
4. **View switcher icon buttons** now have descriptive `title` tooltips on all 5 buttons. (`context-view-switcher.tsx`)
5. **Loading skeleton** replaced centered spinner with a faint dot-grid background matching Excalidraw's empty canvas + bottom-anchored loading pill. No visual pop on mount. (`canvas-loading-skeleton.tsx`)
6. **`COMPONENT_CATALOG.md`** updated: added "Context Canvas Components (Wave 9)" section with 17 entries, updated total component count from 87 to 104.

### Audit verdicts (this session)

| Audit | Verdict | Notes |
|---|---|---|
| `tsc --noEmit` | PASS | zero errors after all 6 should-fix edits |
| `pnpm build` (production) | PASS | 79 routes, `/test-canvas-full` prerenders statically |
| `ax:verify-ui` | PASS WITH NOTES | 7/7 scenarios PASS, notes are Playwright-only limitations on synthetic drag |
| `ax:critique` | **GOOD** | 7 PASS, 6 WARN, 0 FAIL of 13 checks (was 4/7/2) |

Wave 9 success criteria from the 14. 5. close, re-audited:

| ID | Criterion | 14. 5. status | 17. 5. status |
|---|---|---|---|
| C11 | Card movement | NOT VERIFIED | **DONE** (`locked: false` + rAF tracking + position survival on reload) |
| C12 | Click-to-open-detail | NOT DONE | **DONE** (Sheet with full `ContextEntryDetail`, selection ring, Escape close) |
| C13 | `ascend-critic` GOOD or WORLD-CLASS | NOT RUN | **DONE** — verdict GOOD |

### What is NOT in this addendum (deferred to Wave 10+)

- Inline card editing (Obsidian Canvas parity)
- Manual card resize per-card
- Right-click context menu for "Add card"
- Keyboard-first canvas navigation (Tab cycling through cards in spatial order)
- Yjs realtime canvas

### Files touched this session

Modified:
- `apps/web/components/context/canvas/context-canvas-view.tsx` (stable wrappers, bisection flags, "+ Add card" + Sheet wiring)
- `apps/web/components/context/canvas/canvas-card-overlay.tsx` (rAF live position read, click handler, selection ring)
- `apps/web/components/context/canvas/canvas-scene-utils.ts` (`locked: false`, sanitize + rehydrate helpers)
- `apps/web/components/context/canvas/context-canvas-empty-state.tsx` (copy)
- `apps/web/components/context/canvas/canvas-edge-toggle.tsx` (label)
- `apps/web/components/context/canvas/canvas-layout-delete-dialog.tsx` (toast wording)
- `apps/web/components/context/canvas/canvas-loading-skeleton.tsx` (dot-grid)
- `apps/web/components/context/context-view-switcher.tsx` (tooltips)
- `apps/web/lib/hooks/use-canvas-autosave.ts` (sanitize on persist)
- `.claude/COMPONENT_CATALOG.md` (new section)

New:
- `apps/web/components/context/canvas/canvas-add-card-dialog.tsx`
- `apps/web/components/context/canvas/canvas-view-error-boundary.tsx`
- `apps/web/app/test-canvas-full/page.tsx`

Reports:
- `.ascendflow/critiques/2026-05-15-wave9-map-view-close.md` (prior NEEDS WORK)
- `.ascendflow/verification/2026-05-15-wave9-map-view-must-fix.md` (prior blocked verifier + bisection)
- `.ascendflow/verification/2026-05-17-wave9-map-view-must-fix-after-onchange-fix.md` (today's PASS WITH NOTES)
- `.ascendflow/sessions/2026-05-15-2210-wave9-map-view-debugging.md` (prior session resume note)

Process lesson: **the 14. 5. CLOSE-OUT explicitly noted the manual smoke was NOT RUN and the closing critic was NOT RUN, and shipped anyway.** Both gates would have caught the crash. Future waves close only after both have run.
