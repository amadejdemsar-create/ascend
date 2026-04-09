---
phase: 18-timeline-nav-polish
plan: 02
subsystem: ui
tags: [zustand, navigation, command-palette, view-switcher]

# Dependency graph
requires:
  - phase: 03-categories-list-view-and-filtering
    provides: "View switcher and ViewType union in ui-store"
  - phase: 16-context-system
    provides: "Context search API at /api/context/search"
  - phase: 12-todo-data-layer
    provides: "Todo search API at /api/todos/search"
provides:
  - "ViewType reduced to list/tree/timeline (cards removed)"
  - "Grouped sidebar navigation with Inputs/Outputs mental model"
  - "Universal command palette searching goals, todos, and context"
  - "Mobile tab bar focused on 4 key items"
affects: [future-views, mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [grouped-navigation, parallel-search-allSettled]

key-files:
  created: []
  modified:
    - lib/stores/ui-store.ts
    - components/goals/goal-view-switcher.tsx
    - app/(app)/goals/page.tsx
    - components/layout/nav-config.ts
    - components/layout/app-sidebar.tsx
    - components/layout/bottom-tab-bar.tsx
    - components/command-palette/command-palette.tsx
    - components/command-palette/command-actions.ts
    - lib/hooks/use-keyboard-shortcuts.ts

key-decisions:
  - "Keyboard shortcuts remapped: 1=list, 2=tree, 3=timeline (removed slot 4)"
  - "BoardGroupBy type localized into dead board component files rather than deleted to keep TS clean"
  - "Command palette uses Promise.allSettled for parallel search across three entity types"
  - "Mobile tab bar shows Todos, Goals, Calendar, Context (no Dashboard or Settings)"

patterns-established:
  - "NavGroup type for grouped sidebar sections"
  - "Promise.allSettled for multi-entity parallel search with independent error handling"

requirements-completed: [VS-01, VS-02, VS-05]

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 18 Plan 02: View Cleanup, Nav Restructuring, and Command Palette Extension Summary

**Removed cards view, restructured sidebar into Inputs/Outputs groups, extended command palette to search goals, todos, and context in parallel**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T12:13:48Z
- **Completed:** 2026-04-09T12:18:54Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Removed the cards view entirely (ViewType, component, store default, switcher, page rendering, command actions, keyboard shortcuts)
- Restructured sidebar navigation from flat list into grouped sections: Overview, Inputs, Outputs, Knowledge, with Settings separate
- Extended command palette to search three entity types (goals, todos, context) in parallel using Promise.allSettled

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove cards view from ViewType, store, view switcher, and goals page** - `4a3f506` (feat)
2. **Task 2: Restructure sidebar navigation to Inputs/Outputs model** - `79190cb` (feat)
3. **Task 3: Extend command palette to search todos and context documents** - `6cfc0f0` (feat)

## Files Created/Modified
- `lib/stores/ui-store.ts` - ViewType reduced to list/tree/timeline, store version 6, BoardGroupBy removed
- `components/goals/goal-view-switcher.tsx` - Cards option removed, three view buttons remain
- `app/(app)/goals/page.tsx` - GoalCard import and cards rendering branch removed, list is default
- `components/goals/goal-card.tsx` - Deleted (unused)
- `components/layout/nav-config.ts` - NavGroup type added, navGroups with Inputs/Outputs, mobileNavItems
- `components/layout/app-sidebar.tsx` - Renders grouped sections instead of flat Navigation list
- `components/layout/bottom-tab-bar.tsx` - Uses mobileNavItems (4 focused items)
- `components/command-palette/command-palette.tsx` - Parallel search across goals, todos, context
- `components/command-palette/command-actions.ts` - Cards view action removed
- `lib/hooks/use-keyboard-shortcuts.ts` - Keyboard shortcuts remapped (1=list, 2=tree, 3=timeline)
- `components/goals/goal-board-view.tsx` - BoardGroupBy localized as local state
- `components/goals/goal-board-card.tsx` - BoardGroupBy localized as type alias
- `components/goals/goal-board-column.tsx` - BoardGroupBy localized as type alias

## Decisions Made
- Keyboard shortcuts remapped from 1=cards/2=list/3=tree/4=timeline to 1=list/2=tree/3=timeline
- BoardGroupBy type was localized into the (dead code) board component files instead of deleting the board files, keeping changes within plan scope
- Command palette uses Promise.allSettled so one failed search does not block others
- Mobile tab bar omits Dashboard and Settings in favor of the four most used items

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed BoardGroupBy imports in dead board components**
- **Found during:** Task 1 (removing BoardGroupBy from store)
- **Issue:** Three board component files (goal-board-view, goal-board-column, goal-board-card) imported BoardGroupBy from the store. Removing the type broke their compilation.
- **Fix:** Defined BoardGroupBy as a local type alias in each file. Replaced store selector usage with local useState in goal-board-view.
- **Files modified:** components/goals/goal-board-view.tsx, components/goals/goal-board-column.tsx, components/goals/goal-board-card.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** 4a3f506 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed "cards" references in command-actions and keyboard-shortcuts**
- **Found during:** Task 1 (TypeScript check revealed two more files referencing "cards")
- **Issue:** command-actions.ts had a "Switch to Cards View" action and use-keyboard-shortcuts.ts had key "1" mapped to cards view, both using the removed "cards" literal.
- **Fix:** Removed the cards view action from command actions (and unused LayoutGrid import). Remapped keyboard shortcuts to 1=list, 2=tree, 3=timeline.
- **Files modified:** components/command-palette/command-actions.ts, lib/hooks/use-keyboard-shortcuts.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** 4a3f506 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both blocking issues, Rule 3)
**Impact on plan:** Both fixes were necessary for TypeScript to compile. No scope creep.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- View system is simplified and clean (list, tree, timeline)
- Navigation reflects the Inputs/Outputs mental model
- Command palette is universally useful across all entity types
- Ready for any future view additions or further polish

---
*Phase: 18-timeline-nav-polish*
*Completed: 2026-04-09*
