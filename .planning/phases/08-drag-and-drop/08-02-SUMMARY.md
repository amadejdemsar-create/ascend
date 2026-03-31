---
phase: 08-drag-and-drop
plan: 02
subsystem: ui
tags: [dnd-kit, react, drag-and-drop, sortable, droppable, board-view, list-view, tree-view, category-grouping]

# Dependency graph
requires:
  - phase: 08-drag-and-drop
    plan: 01
    provides: DndGoalProvider, GoalDragOverlay, reorder API, sortOrder field
provides:
  - Sortable list rows with grip handles in List view
  - Sortable board cards with cross-column drops in Board view
  - Sortable tree nodes scoped to parent groups in Tree view
  - Category board grouping option for cross-column category changes
  - DndGoalProvider wrapping List and Tree views in goals page
affects: [08-drag-and-drop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "View-scoped DnD types (goal-row, goal-card, tree-node) prevent cross-view interference"
    - "Board view manages its own DragDropProvider with optimistic reorder via move()"
    - "DndGoalProvider onDragEndExtra callback for view-specific reorder persistence"
    - "Category board grouping derives columns dynamically from useCategories data"

key-files:
  created: []
  modified:
    - lib/stores/ui-store.ts
    - components/goals/goal-list-view.tsx
    - components/goals/goal-board-view.tsx
    - components/goals/goal-board-column.tsx
    - components/goals/goal-board-card.tsx
    - components/goals/goal-tree-view.tsx
    - components/goals/goal-tree-node.tsx
    - components/goals/dnd-goal-provider.tsx
    - app/(app)/goals/page.tsx

key-decisions:
  - "Board view manages its own DragDropProvider instead of sharing page-level DndGoalProvider, because it needs onDragOver with move() for optimistic cross-column reorder"
  - "Only one DragDropProvider active at a time since views render conditionally based on activeView"
  - "DndGoalProvider receives onDragEndExtra for List and Tree reorder persistence, keeping provider generic"
  - "Zustand persist version bumped from 3 to 4 with identity migration for BoardGroupBy type widening"

patterns-established:
  - "View-scoped DnD types: each view uses a unique type string (goal-row, goal-card, tree-node) to prevent cross-view drag interference within the same DragDropProvider"
  - "Optimistic board reorder: Board view uses move() from @dnd-kit/helpers in onDragOver for instant visual feedback, reverting to snapshot on cancel"
  - "Category board grouping: dynamic columns from useCategories with uncategorized bucket"

requirements-completed: [DND-01, DND-02, DND-03, DND-04]

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 8 Plan 2: List, Board, and Tree View DnD Wiring Summary

**Sortable rows, cards, and tree nodes with cross-column board drops for horizon, status, and category changes via @dnd-kit/react hooks**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T14:28:57Z
- **Completed:** 2026-03-31T14:35:13Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- List view rows are now sortable via grip handle with drag reorder persisting via reorder API
- Board view supports drag and drop within columns (reorder) and between columns (field change), with a new "Category" grouping option
- Tree view nodes are sortable within their parent group via grip handles
- All three views use view-scoped DnD type strings to prevent cross-view interference
- Board view manages its own DragDropProvider with optimistic reorder; List and Tree use DndGoalProvider at page level

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire DnD into List view and Board view (with category grouping)** - `78d7bf1` (feat)
2. **Task 2: Wire DnD into Tree view and connect DndGoalProvider in goals page** - `700a8a7` (feat)

## Files Created/Modified
- `lib/stores/ui-store.ts` - Extended BoardGroupBy to include "category", bumped persist version to 4
- `components/goals/goal-list-view.tsx` - Added SortableGoalRow with grip handle and useSortable
- `components/goals/goal-board-view.tsx` - Added own DragDropProvider with move() optimistic reorder, category grouping, DragOverlay
- `components/goals/goal-board-column.tsx` - Added useDroppable with collision priority and drop target highlight
- `components/goals/goal-board-card.tsx` - Added useSortable with group prop for cross-column sorting
- `components/goals/goal-tree-view.tsx` - Passes index and parentId to tree nodes
- `components/goals/goal-tree-node.tsx` - Added useSortable with group scoped to parentId, grip handle
- `components/goals/dnd-goal-provider.tsx` - Added onDragEndExtra callback prop, removed unused useReorderGoals
- `app/(app)/goals/page.tsx` - Wraps List and Tree in DndGoalProvider with findGoal and onDragEndExtra

## Decisions Made
- Board view manages its own DragDropProvider because it needs onDragOver with move() for optimistic cross-column reorder, which the simpler DndGoalProvider does not support
- Since only one view is active at a time (conditional rendering based on activeView), there is never more than one DragDropProvider in the DOM
- DndGoalProvider was enhanced with onDragEndExtra rather than being replaced, keeping it usable for List and Tree views
- Category columns are derived dynamically from useCategories data with an "Uncategorized" bucket for goals without categories

## Deviations from Plan

None. Plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None. No external service configuration required.

## Next Phase Readiness
- All three views (List, Board, Tree) have functional drag and drop
- Ready for Plan 03 which adds visual feedback (drag overlays, animations, accessibility)
- DnD type scoping (goal-row, goal-card, tree-node) is ready for Plan 03 overlay customization

## Self-Check: PASSED

All 10 modified/created files verified present on disk. Both task commits (78d7bf1, 700a8a7) verified in git log. TypeScript compiles cleanly with no errors.

---
*Phase: 08-drag-and-drop*
*Completed: 2026-03-31*
