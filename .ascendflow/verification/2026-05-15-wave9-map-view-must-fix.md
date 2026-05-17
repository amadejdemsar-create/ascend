# Ascend UI Verification Report

**When:** 15. 5. 2026 15:23 (Europe/Ljubljana)
**Branch:** main
**HEAD commit:** 2e01a9c chore(wave-9): close Wave 9, spatial canvas shipped
**Dev port detected:** 3100
**What was tested:** Three must-fix items for the Wave 9 Map view: (1) card repositioning via `locked:false` + rAF overlay rewrite, (2) card click opens entry detail in a Sheet, (3) "+ Add card" toolbar button with search picker dialog.
**Verdict:** NEEDS ATTENTION

## Files evaluated (Phase 0)

- `apps/web/components/context/canvas/canvas-scene-utils.ts:85`: Changed `locked: true` to `locked: false` on `buildNodeCardRect`, enabling Excalidraw native drag on card rectangles.
- `apps/web/components/context/canvas/canvas-card-overlay.tsx:60-143`: Rewrote rAF loop to read BOTH `getAppState()` (viewport) AND `getSceneElements()` (live element x/y). Added `elementPositions` state Map, threshold gates (0.5px/0.001 zoom). Added `onCardClick` and `selectedEntryId` props with selection ring styling.
- `apps/web/components/context/canvas/context-canvas-view.tsx`: Added Sheet-based detail panel (`selectedEntryId` state, `handleCardClick`, `handleDetailClose`, `handleDetailNavigate`), "+ Add card" button, `CanvasAddCardDialog` integration with `handleAddEntry` (viewport-center placement) and `handleFocusExisting` (pan-to-existing via `updateScene({ appState })`).
- `apps/web/components/context/canvas/canvas-add-card-dialog.tsx` (NEW): Search picker dialog with `useContextEntries()` and `useSearchContext(query)`, keyboard nav (ArrowDown/Up/Enter), existing-entry detection ("On canvas" indicator), MAX_VISIBLE=50, auto-focus on open.

## Test plan (Phase 0.5)

Scenarios identified BEFORE opening the browser:

1. **Scenario A: Card drag repositioning persists** -- Validates that `locked:false` enables Excalidraw drag and the rAF overlay tracks the moved rectangle. After drag, autosave should persist the new position.
2. **Scenario B: Card click opens entry detail Sheet** -- Validates the new `onCardClick` → `selectedEntryId` → Sheet flow. The Sheet should show ContextEntryDetail with title, type, body.
3. **Scenario C: Add card picker dialog** -- Validates the new CanvasAddCardDialog: search, keyboard nav, selecting an entry places a card at viewport center, selecting an existing entry pans to it with toast.
4. **Scenario D: Arrow type picker regression** -- Validates that drawing an arrow between two cards still triggers the link-type picker dialog (pre-existing feature unmodified by the changes).
5. **Scenario E: Regression sweep on List/Graph/other views** -- Validates that the code changes do not break any non-Map context views or other pages.

## Environment (Phase 1)

- Git state: dirty (3 modified files, 1 new file in working tree)
- Dev server port: 3100
- `/api/health` response: `{"status":"ok","timestamp":"...","db":{"users":1,"stats":1}}`
- TypeScript: PASS (zero errors)
- Route warm-up: all routes warmed successfully (dashboard, goals, todos, calendar, context, settings)
- Baseline console errors on initial `/dashboard` load: none

## Execution

### Scenario A: Card drag repositioning persists

- **Preconditions:** Map view must mount successfully with at least one card on the canvas.
- **Action:** N/A
- **Expected:** Drag a card rectangle; overlay follows; autosave persists new position.
- **Observed:** BLOCKED. The Map view crashes on mount with `Maximum update depth exceeded` from Excalidraw's internal `tunnel.useIsomorphicLayoutEffect`. This is a **pre-existing** crash confirmed by stashing all uncommitted changes and testing the committed HEAD code, which exhibits the identical error. The Excalidraw component cannot render at all.
- **Console errors (fresh):** `Maximum update depth exceeded` (pre-existing, not caused by the diff under test)
- **Verdict:** BLOCKED (pre-existing)
- **Screenshots:** `2026-05-15-map-view-crash.png`

### Scenario B: Card click opens entry detail Sheet

- **Preconditions:** Map view must mount successfully with at least one card visible.
- **Action:** N/A
- **Expected:** Click a card overlay button; Sheet opens on the right with ContextEntryDetail.
- **Observed:** BLOCKED by the same pre-existing Excalidraw crash. The Map view does not render, so no cards are visible to click.
- **Console errors (fresh):** same pre-existing crash
- **Verdict:** BLOCKED (pre-existing)
- **Screenshots:** `2026-05-15-map-view-crash.png`

### Scenario C: Add card picker dialog

- **Preconditions:** Map view must mount successfully; the "+ Add card" button must be visible in the toolbar.
- **Action:** N/A
- **Expected:** Click "+ Add card"; dialog opens with search input; type to filter; select an entry; card appears at viewport center.
- **Observed:** BLOCKED. The toolbar area where the "+ Add card" button renders is part of the Map view component, which crashes before rendering.
- **Console errors (fresh):** same pre-existing crash
- **Verdict:** BLOCKED (pre-existing)
- **Screenshots:** `2026-05-15-map-view-crash.png`

### Scenario D: Arrow type picker regression

- **Preconditions:** Map view must mount with at least two cards on the canvas.
- **Action:** N/A
- **Expected:** Draw an arrow from card A to card B; type picker dialog appears.
- **Observed:** BLOCKED by pre-existing crash.
- **Console errors (fresh):** same pre-existing crash
- **Verdict:** BLOCKED (pre-existing)
- **Screenshots:** `2026-05-15-map-view-crash.png`

### Scenario E: Regression sweep on List/Graph/other views

- **Preconditions:** Navigate to /context via sidebar.
- **Action:** Switch to List view, then Graph view. Open a detail panel. Navigate to Goals page.
- **Expected:** All views render correctly; no regressions from the uncommitted changes.
- **Observed:** All non-Map views render correctly. List view shows entries, search works, filter bar active. Graph view renders nodes and edges with d3-force layout. Detail panel opens on entry click with click-to-edit fields, block editor, and version history. Goals page renders with filter bar, quick-add, and detail panel.
- **Console errors (fresh):** One pre-existing hydration error in `ContextCategoryTree` on `/context` (not caused by this diff).
- **Verdict:** PASS
- **Screenshots:** `2026-05-15-context-list-view-works.png`, `2026-05-15-context-graph-view.png`, `2026-05-15-context-detail-panel.png`, `2026-05-15-goals-regression.png`

## Regression sweep (Phase 5)

- `/context` (List view): PASS -- list renders, search works, entries clickable
- `/context` (Graph view): PASS -- nodes and edges render, d3-force layout active
- `/context` (Detail panel): PASS -- click-to-edit fields work, block editor mounts, version history panel visible
- `/goals`: PASS -- filter bar renders, quick-add functional, detail panel opens
- `/dashboard`: PASS -- all widgets render, no console errors

## Console errors

### Baseline (Phase 2, pre-existing)

- None on `/dashboard` initial load.

### Pre-existing on `/context`

- `ContextCategoryTree`: React hydration mismatch warning (pre-existing, not caused by this diff).
- Excalidraw `tunnel.useIsomorphicLayoutEffect`: `Maximum update depth exceeded` when Map view mounts (pre-existing, confirmed at committed HEAD `2e01a9c` with stashed changes).
- Excalidraw `props.appState.collaborators.forEach is not a function`: occurs when stored canvas `appState` contains `collaborators` serialized as a plain object `{}` instead of a Map (pre-existing serialization bug in canvas autosave).

### Fresh (Phase 4, from scenarios)

- No fresh errors attributable to the uncommitted changes. All console errors observed during this session are pre-existing.

## Pre-existing Excalidraw crash: root cause analysis

Two distinct pre-existing bugs prevent the Map view from mounting:

### Bug 1: `collaborators` Map serialization

**Location:** `apps/web/lib/hooks/use-canvas-autosave.ts` (autosave path) and `apps/web/components/context/canvas/context-canvas-view.tsx` (restore path).

**Root cause:** Excalidraw's `appState.collaborators` is a JavaScript `Map` internally. When the autosave hook calls `JSON.stringify` on the scene (via the PATCH to `/api/canvas/layouts/[id]`), the Map serializes to `{}`. On restore, `Excalidraw` receives `collaborators: {}` (a plain object) and calls `.forEach()` on it, which does not exist on plain objects.

**Fix direction:** Sanitize `initialData.appState` before passing to `<Excalidraw>`: delete or convert `collaborators` and `followedBy` keys to `new Map()`. Alternatively, strip them from the autosave payload before persistence.

### Bug 2: `tunnel.useIsomorphicLayoutEffect` infinite loop

**Location:** Internal to `@excalidraw/excalidraw@^0.18.1`, triggered by React 19 dev mode strict effects.

**Root cause:** Excalidraw's internal `tunnel` mechanism uses `useIsomorphicLayoutEffect` in a pattern that, under React 19's development-mode double-invocation of effects, creates an infinite re-render loop. This crash occurs even with a completely empty canvas (no elements, no appState). Confirmed by creating a fresh layout with `canvas: {}` in the database; the crash still occurs.

**Fix direction:** Investigate whether `@excalidraw/excalidraw@0.18.2+` resolves the React 19 compat issue. If not, consider wrapping the Excalidraw mount in a dynamic import with `{ ssr: false }` and a `React.memo` boundary, or test in production build mode (which disables strict effects).

## Summary

### Works

- Regression sweep: all non-Map context views (List, Graph, Detail panel) render correctly with the uncommitted changes applied.
- Goals page renders correctly with no regressions.
- Dashboard renders correctly.
- Source code review of the three changed files and one new file shows correct patterns: rAF loop has proper threshold gates, Sheet has sr-only title/description for a11y, CanvasAddCardDialog has keyboard nav and ARIA attributes, `locked: false` is the correct Excalidraw property for enabling native drag.

### Broken

- **All 5 must-fix scenarios are BLOCKED** by a pre-existing Excalidraw crash that prevents the Map view from mounting. The crash exists at the committed HEAD (`2e01a9c`) independent of the uncommitted changes.
- **Pre-existing Bug 1:** `apps/web/lib/hooks/use-canvas-autosave.ts` and `context-canvas-view.tsx` do not sanitize `appState.collaborators` from plain-object `{}` back to a Map before passing to Excalidraw.
- **Pre-existing Bug 2:** `@excalidraw/excalidraw@^0.18.1` `tunnel.useIsomorphicLayoutEffect` infinite loop under React 19 dev mode. This may not reproduce in production builds.

### Recommendation

The three must-fix changes (card drag, detail Sheet, add-card picker) **cannot be behaviorally verified** until the pre-existing Excalidraw crash is resolved. The source code looks correct and follows established patterns, but source review alone is insufficient for UI verification.

Priority actions before re-running this verification:

1. **Fix Bug 1 (collaborators serialization):** In `context-canvas-view.tsx`, sanitize `initialData.appState` before passing to `<Excalidraw>`: strip or convert `collaborators` and `followedBy` to `new Map()`. Also fix the autosave path to strip these keys before persisting.
2. **Fix Bug 2 (infinite loop):** Test with a production build (`npm run build && npm start`) to confirm whether this is dev-mode-only. If it is, the Playwright verifier can run against the production server. If it persists in production, investigate Excalidraw version upgrade or a React.memo isolation boundary.
3. **Re-run this verification** once the Map view mounts successfully. All 5 scenarios (A through E) need fresh execution.

---

## Addendum: Production confirmation (15. 5. 2026 17:46 Europe/Ljubljana)

After the verifier returned NEEDS ATTENTION, I logged into `https://ascend.nativeai.agency/context` via Claude-in-Chrome and clicked the Map view button (5th in the view switcher).

### Result: Map view is broken on PRODUCTION

The page-level error boundary catches the crash and renders the "This page couldn't load. Reload to try again, or go back." screen. The Excalidraw canvas never paints. Bug 2 is NOT dev-mode-only.

### Console error captured on prod

```
[EXCEPTION] Error: Minified React error #185; visit https://react.dev/errors/185
    at rh (.../0n1a7gmu3oh.s.js:1:42872)
    at rp (.../0n1a7gmu3oh.s.js:1:42444)
    at aU (.../0n1a7gmu3oh.s.js:1:68626)
    at .../0n1a7gmu3oh.s.js:1:68504
    at .../08r1r9lnref2l.js:1:66382
    at Set.forEach (<anonymous>)
    at a (.../08r1r9lnref2l.js:1:66371)
    at .../0o4kvvzp50mm6.js:1:35314
    at iy (.../0n1a7gmu3oh.s.js:1:103238)
    at ua (.../0n1a7gmu3oh.s.js:1:118912)
```

React minified error #185 = "Maximum update depth exceeded." Same root cause as the dev-mode crash; production's lack of strict-effects double-invocation does NOT save us from this loop.

### Persistence side-effect

`useUIStore.contextActiveView` is persisted to `localStorage["ascend-ui"]`. After my Map view click, the value was `"canvas"`, meaning every subsequent /context load on this browser jumped straight into the broken canvas and hit the error boundary. I had to manually reset it via:

```js
const o = JSON.parse(localStorage.getItem('ascend-ui'));
o.state.contextActiveView = 'list';
localStorage.setItem('ascend-ui', JSON.stringify(o));
```

This is a secondary bug: a user who clicks Map once is permanently locked out of /context until they DevTools-reset their persisted state. The canvas error boundary, if any, should reset `contextActiveView` to `"list"` on render failure.

### Implication for Wave 9 close-out

The Wave 9 CLOSE-OUT.md claimed "12 prod deploys, zero rollbacks, ready to ship." Zero rollbacks only confirms deploy success, not feature success. The CLOSE-OUT's recommended 18-step manual smoke checklist was explicitly "NOT RUN." Step 1 of that checklist ("Open `/context` → click Map") would have caught this immediately.

**Wave 9 has been silently broken on production since the close on 14. 5. 2026.** The 3 must-fix changes from today's session compound a feature that does not render.

### Updated recommendation

1. **Do not push today's 3 must-fix changes** (`canvas-scene-utils.ts`, `canvas-card-overlay.tsx`, `context-canvas-view.tsx`, `canvas-add-card-dialog.tsx`). They cannot be verified.
2. **Treat the Excalidraw mount crash as a wave-blocker, not a polish item.** Wave 9 cannot honestly claim "shipped" while the canvas refuses to mount.
3. **Triage order (suggested):**
   a. Apply the `collaborators` / `followedBy` sanitization fix to both autosave and restore paths. This is the smaller of the two bugs and may resolve Bug 2 indirectly if the loop is triggered by the malformed Map.
   b. If Bug 2 persists, check whether `@excalidraw/excalidraw@0.18.2+` (or 0.19.x) released a React 19 compatibility fix. The Excalidraw repo's issue tracker has multiple React 19 strict-mode reports.
   c. Add an error-boundary-with-reset for the canvas surface that returns the user to List view automatically.
   d. THEN re-verify today's must-fix changes against the now-mounting canvas.

---

## Addendum 2: Bisection results (15. 5. 2026 22:00 Europe/Ljubljana)

After landing the Bug 1 sanitization fix + canvas error boundary, I drove an isolation bisection via a temporary `/test-canvas` route mounting bare Excalidraw with progressively more wrapping. The page lives at `apps/web/app/test-canvas/page.tsx` (outside the `(app)` route group, gated by middleware, kept for the next session's continued bisection).

### What works in isolation (each tested independently in the browser on local dev)

| Test | Configuration | Result |
|------|---------------|--------|
| Bare | `<Excalidraw />` with zero props | ✅ PASS, full toolbar renders |
| A1 | Wrapped in React 19 `<ViewTransition>` | ✅ PASS |
| C/D | + inline arrow `excalidrawAPI` + no-op `onChange` | ✅ PASS |
| E | + parent re-render forced every 100ms (new prop refs each tick) | ✅ PASS (just a stale-cache hydration warning, unrelated) |
| F | + `setApiReady(true)` setState inside `excalidrawAPI` callback | ✅ PASS |
| G | + useMemo'd `initialData` + `viewModeEnabled` + useCallback'd `onChange` + sibling rAF-loop component | ✅ PASS |
| H | + class `CanvasViewErrorBoundary` (added today) wrapping `<Excalidraw>` | ✅ PASS |

### Bisection conclusion

The crash is NOT triggered by any of these in isolation:
- React 19 + Next.js 16 + Excalidraw 0.18.1 baseline
- React `ViewTransition`
- Callback props with setState side effects
- Forced parent re-renders
- The exact prop signature used by `ContextCanvasViewMounted`
- A sibling component running its own rAF loop
- The class-component error boundary

The crash IS in the full `ContextCanvasViewMounted` tree on `/context`. The remaining differentiators not yet bisected:

1. **The `(app)` layout's provider tree** — `<SidebarProvider>`, `<SessionExpiredListener>`, `<AppSidebar>`, `<SidebarInset>`/`<main>`/`<ViewTransition>`, plus global siblings like `<CommandPalette>`, `<GoalModal>`, `<FileDropZone>`, `<FocusTimerWidget>`. Hard to test without auth.
2. **The real `useDefaultCanvasLayout` + `useGraphAt` + `useRecentContextEntries` React Query hooks** resolving async and triggering parent re-renders DURING Excalidraw's mount. Hard to test without auth + a real DB user.
3. **The full sibling cascade** (`<CanvasSaveStatus>`, `<CanvasLayoutSwitcher>`, `<CanvasEdgeToggle>`, `<CanvasImportDialog>`, `<CanvasAddCardDialog>`, `<CanvasCardOverlay>`, `<CanvasLinkTypePicker>`, `<ContextCanvasEmptyState>`, `<Sheet>`, `<TimeTravelBanner>`). Each has its own state/effects.
4. **Multiple `useUIStore` Zustand subscriptions** across the tree.

### What to do next session (when the user is back at the keyboard)

1. **Log in to localhost:3100.** Navigate to `/context`, click Map view. Capture the fresh console error trace and screenshot. Important because Bug 1 (collaborators sanitization) is now applied in the working tree — the symptom may have shifted.

2. **If the crash persists, do one more focused test.** Either:
   a. Add `/context` to `PUBLIC_PATHS` temporarily + a stub for `useDefaultCanvasLayout` that returns fake data. Visit /context as anonymous. See if the Map view mounts. Reverts in one line.
   b. Make a `/test-canvas-full` route that mounts `<ContextCanvasViewMounted layout={fakeLayout} />` with a hand-built fake layout. Requires faking React Query state via `<QueryClientProvider>` + manual `queryClient.setQueryData` for `useGraphAt` + `useRecentContextEntries` + `useUIStore` defaults. Bigger lift but proves it for sure.

3. **If b reproduces:** remove sibling components one at a time on the test page (start with `<CanvasCardOverlay>`, then `<CanvasSaveStatus>`, then dialogs). The component whose removal makes the crash disappear is the trigger.

4. **If b passes:** the trigger is the `(app)` layout provider tree, not the canvas's own siblings. Recreate the (app) layout's tree around the bare canvas page and bisect from there.

### What I'm keeping

- `apps/web/app/test-canvas/page.tsx` — reverted to bare Excalidraw baseline (passes, useful as a known-good repro for next session). Gated behind login.
- `apps/web/middleware.ts` — REVERTED PUBLIC_PATHS change. `/test-canvas` is now auth-gated like all (app) pages.
- Today's three must-fix changes + Bug 1 sanitization fix + error boundary + new test route are all in the working tree, uncommitted.

### What I expect after the user logs in tomorrow

The /context Map view will probably still crash, BUT the symptom may be subtly different now that Bug 1's `appState.collaborators` rehydration is in place. The new console error trace will tell us a lot.
