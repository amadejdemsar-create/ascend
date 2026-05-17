# Wave 9 Close: Spatial Canvas (Map view) — Product Critique

**Scope:** Wave 9 close (Spatial Canvas / Map view on `/context`)
**Date:** 15. 5. 2026
**Critic:** `ascend-critic`
**Competitor reference set:** Excalidraw, Obsidian Canvas, Heptabase, Notion, Whimsical, FigJam, Miro, Apple Freeform, Raycast, Arc

---

## Verdict: **NEEDS WORK**

3 must-fix items. The Map view ships an impressive amount of infrastructure but the core interaction loop of a spatial canvas (move cards, click cards, add specific cards) is broken or unverified. After those three fixes and a browser verification pass, the verdict would likely move to GOOD.

---

## Product quality check matrix (13 checks)

| Check | Verdict | One-line rationale |
|------|---------|--------------------|
| PQ1 — Solves stated problem | WARN | "Lay nodes out by hand" is the core promise; card rectangles are created with `locked: true` and have no overlay drag handler |
| PQ2 — Core interaction <3 clicks | WARN | Quick-add path is 2 clicks (PASS), but adding a specific entry from full-bleed Map is 3+ clicks with view-switching |
| PQ3 — Empty states designed | WARN | Empty state is thoughtful (icon + heading + CTA) but copy "Drag entries from the sidebar" is misleading in full-bleed mode |
| PQ4 — Error states designed | PASS | Load failure, import failure, layout delete failure, autosave failure, type picker failure all have specific human messages |
| PQ5 — Keyboard navigation | WARN | Excalidraw native shortcuts work; custom canvas shortcuts and Cmd+K canvas-search are missing |
| PQ6 — No layout shift on load | FAIL | Centered spinner → full-bleed canvas is a visible layout shift; every other view uses dimension-matching skeletons |
| PQ7 — Single source of truth | WARN | Clicking a card does nothing (`onCardClick` accepted but not wired); user must leave Map view to read entry content |
| PQ8 — Feels fast | PASS | `next/dynamic` code split, rAF threshold gate, debounced autosave, list query excludes blob, pure-canvas update skips list invalidation |
| PQ9 — Delight at achievement | PASS | Confetti on new layout (`prefers-reduced-motion` respected), live "Saved Xs ago" pill |
| PQ10 — Human copy | WARN | Delete dialog copy is excellent; "Edges" is graph jargon (should be "Connections"), "Deleted layout" toast is harsh |
| PQ11 — Purpose obvious in 10s | WARN | Map icon is icon-only with no visible tooltip; empty state lacks a ghost/placeholder visualization of a populated canvas |
| PQ12 — No dead ends | PASS | Every destructive action confirmed, every modal Escape-able, autosave failure has Retry, time-travel banner has "Return to now" |
| PQ13 — Competitive parity | FAIL | Three core canvas interactions (drag card, click card, add specific card) are below every competitor in the reference set |

**Tally:** 4 PASS, 7 WARN, 2 FAIL.

---

## Must-fix before declaring wave user-ready

### 1. Card repositioning is broken or unverified

**Checks:** PQ1, PQ13
**Files:**
- `apps/web/components/context/canvas/canvas-scene-utils.ts` line 84 (`locked: true`)
- `apps/web/components/context/canvas/canvas-card-overlay.tsx` (no drag handler on the `<button>`)
- `apps/web/lib/hooks/use-canvas-autosave.ts` lines 83-107 (node-position-delta detector)

**Description:** Card rectangles are created with `locked: true` and the React overlay `<button>` only handles `onClick`. After initial placement (Quick-add or drop), cards appear frozen. The autosave's node-position-delta detection will never fire because the underlying Excalidraw rectangles never move. The CLOSE-OUT smoke test step 4 describes card movement working, but `ax:verify-ui` never ran to verify.

**Impact:** The entire value proposition of a spatial canvas is "arrange things in space." A canvas where cards cannot be moved is not a spatial thinking tool, it is a random-scatter visualization.

**Competitor reference:** Every spatial canvas (Excalidraw, Obsidian Canvas, Heptabase, Miro, FigJam, Apple Freeform) allows click+drag to reposition cards. This is the baseline expectation.

**Fix path:** Either (a) set `locked: false` on card rects and let Excalidraw handle drag natively (the overlay tracks via rAF), or (b) implement drag handlers on the React overlay `<button>` that update both the Excalidraw element position and the CanvasNode. Option (a) is simpler. Verify in the browser that autosave detects position deltas after the fix.

---

### 2. Card click does nothing (detail navigation broken)

**Checks:** PQ7, PQ13
**Files:**
- `apps/web/components/context/canvas/context-canvas-view.tsx` lines 566-569 (no `onCardClick` prop passed to `CanvasCardOverlay`)
- `apps/web/components/context/canvas/canvas-card-overlay.tsx` line 169 (button accepts `onClick` but parent never wires it)

**Description:** The card overlay renders each card as a `<button>` with `onClick={() => onCardClick?.(node.contextEntryId)}` but the parent component never passes `onCardClick`. Clicking a card is a no-op. The user sees a hover state (border highlight, shadow increase) suggesting interactivity, but nothing happens.

**Impact:** A card that looks clickable but does nothing erodes trust. More importantly, the user cannot navigate from the spatial view to entry content. They are forced to switch views to read any card.

**Competitor reference:** Heptabase opens a side panel with full card body + backlinks on click. Obsidian Canvas opens the note for editing inline. Notion boards show a detail modal.

**Fix path:** Wire `onCardClick` from `ContextCanvasViewMounted` to `CanvasCardOverlay`, calling `setSelectedContextEntryId` in Zustand (matching the List view pattern). Show the entry detail panel in the right side panel.

---

### 3. No way to add a specific entry to the canvas from the Map view

**Checks:** PQ2, PQ11
**Files:**
- `apps/web/components/context/canvas/context-canvas-empty-state.tsx` (copy says "Drag entries from the sidebar")
- `apps/web/app/(app)/context/page.tsx` line 282 (`isFullBleedView` hides the entry list)

**Description:** In full-bleed Map mode the entry list panel is hidden. The app sidebar contains nav links and categories, not entry rows. The empty state instructs users to "Drag entries from the sidebar" but there are no entries visible to drag. The Cmd+K entry picker was dropped from Wave 9 scope. The only working mechanism is "Quick-add 5 recent entries" which gives no control over selection.

**Impact:** After Quick-add the user has no UI path to add a specific entry to the canvas without leaving the Map view. This is a core workflow gap that makes the canvas feel disconnected from the rest of the knowledge base.

**Competitor reference:** Heptabase right-click canvas → "Add card" → inline search picker. Obsidian Canvas toolbar "Add note" button → search modal. Miro drag from sidebar or paste content inline.

**Fix path:** Add a "+ Add card" button to the canvas toolbar that opens the existing command palette (`Cmd+K`) or a mini-picker dialog, and places the selected entry at the canvas center. Simpler than re-showing the entry list in a collapsible rail.

---

## Should-fix (next sprint)

1. **Loading skeleton should match canvas dimensions.** Replace the centered spinner in `canvas-loading-skeleton.tsx` with a canvas-shaped placeholder (gray background matching the Excalidraw canvas color, perhaps with a faint grid pattern and a centered loading indicator). Prevents the layout shift from spinner to full-bleed canvas. (PQ6)

2. **Empty state copy should be accurate.** Change "Drag entries from the sidebar" to "Use Quick-add below or the + button in the toolbar to place entries on your canvas." Matches what the user can actually do. (PQ10, PQ11)

3. **View switcher buttons need tooltips.** All 5 icon-only buttons (List, Graph, Map, Pinned, Backlinks) in `context-view-switcher.tsx` have `aria-label` but no visible tooltip on hover. A new user cannot identify what each icon does without clicking. Add `title` attributes or shadcn `Tooltip` wrappers. (PQ11)

4. **Edge toggle label should use "Connections" not "Edges."** Change the visible text from "Edges on" / "Edges off" to "Connections" matching the `title` attribute's "Show connections" / "Hide connections." Users think in connections, not edges. (PQ10)

5. **No error boundary wraps the canvas.** Excalidraw is a complex third-party library. A render failure will crash the entire `/context` page. The block editor has an error boundary (DZ-7 mitigation); the canvas should too. Wrap `ContextCanvasViewMounted` in an error boundary that falls back to a "Canvas failed to load. Try refreshing." message. (PQ4 enhancement)

6. **"Deleted layout" toast should soften.** Change `toast.success('Deleted layout "...".')` to `toast.success('Layout "..." removed.')` for less permanent-sounding language. (PQ10)

---

## Bright spots

1. **Edge sync is genuinely clever.** The `diffArrows` function in `canvas-edge-sync.ts` that detects new arrows binding two card rectangles and opens the type picker is a well-engineered bridge between Excalidraw's native arrow tool and Ascend's typed-link model. Drawing an arrow and being asked "how does this relate?" is a workflow no competitor does. This is a differentiator worth highlighting.

2. **Delete dialog copy is excellent.** `CanvasLayoutDeleteDialog` lines 57-61 explicitly tells the user what IS deleted (annotations, strokes, positions) and what is NOT (entries, typed links). The kind of precise, reassuring copy that builds trust.

3. **Import dialog is well-designed.** The Replace vs Merge mode picker with clear labels, the `.tldr` rejection with a specific help link, the element count preview, and the 4 MiB pre-parse cap are all carefully thought through. A small feature done at a high quality bar.

4. **Autosave status pill is a model component.** `canvas-save-status.tsx` handles 4 states cleanly, uses `role="status"` and `aria-live="polite"`, has a Retry button on failure, and shows a live relative timestamp. It also hides completely in idle state rather than showing "nothing to save." Exactly how autosave feedback should work.

5. **Activity feed integration.** Four canvas event types (`CANVAS_LAYOUT_CREATED`, `CANVAS_LAYOUT_DELETED`, `CANVAS_NODE_ADDED`, `CANVAS_NODE_REMOVED`) integrated into the existing activity feed with a "Canvas" filter group. Completeness many teams skip on v1.

6. **Layout switcher + kebab menu.** Dropdown with active checkmark, per-row node count, kebab → Rename/Delete is clean and functional. The "refuse to delete last layout" guard with inline error is thoughtful.

---

## Wave 9 success criteria audit (selected)

Per CLOSE-OUT, all functional criteria were marked done. Auditing the ones that matter for product quality:

| ID | Criterion | Status |
|----|-----------|--------|
| C1 | Excalidraw embedded | DONE |
| C2 | Three card sizes (auto by zoom) | DONE |
| C3 | Edge rendering from ContextLinks | DONE |
| C4 | Edge creation via arrow + type picker | DONE |
| C5 | Layout switcher + CRUD | DONE |
| C6 | Autosave | DONE |
| C7 | Drag-from-sidebar | DONE (code exists) but functionally broken in full-bleed mode |
| C8 | `.excalidraw` import/export | DONE |
| C9 | Three MCP tools | DONE |
| C10 | Time-travel-aware | DONE |
| C11 | Card movement | NOT VERIFIED (`locked: true` + no overlay drag handler) |
| C12 | Click-to-open-detail | NOT DONE (listed as carryover, `onCardClick` not wired) |
| C13 | `ascend-critic` verdict at GOOD or WORLD-CLASS | NOT YET (this pass returned NEEDS WORK) |

---

## Recommendation

Address all 3 must-fix items, run `ax:verify-ui` in the browser, then re-run `ax:critique`. Do not declare Wave 9 user-ready until the critic verdict reaches GOOD or better.

The must-fix items are all addressable in a single focused session: unlock card rects, wire `onCardClick`, add a "+ Add card" button.

A world-class operator would try the canvas, discover they cannot move or click the cards, and switch back to the Graph view. Wave 9 cannot ship with that failure mode.
