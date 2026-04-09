---
phase: 18-timeline-nav-polish
plan: 01
subsystem: ui
tags: [react, css-grid, gantt, timeline, tree]

requires:
  - phase: 07-timeline-view
    provides: "Timeline view with zoom controls, date math utilities, time segment grid"
provides:
  - "Gantt tree chart with horizontal bars replacing swim-lane layout"
  - "flattenTree helper and FlatTimelineRow type for tree row rendering"
  - "Collapsible tree hierarchy with sticky left panel"
affects: [18-02-PLAN]

tech-stack:
  added: []
  patterns: ["Single CSS Grid with sticky positioning for Gantt layout", "flattenTree with local expand/collapse state"]

key-files:
  created: []
  modified:
    - lib/timeline-utils.ts
    - components/goals/goal-timeline-view.tsx
    - components/goals/goal-timeline-node.tsx

key-decisions:
  - "Single CSS Grid approach (not split-panel with scroll sync) for guaranteed row alignment"
  - "Expand/collapse in local useState, not Zustand, since it is view-specific and transient"
  - "240px tree panel width with truncated titles (bar labels provide secondary readability)"
  - "Mobile hides tree panel via CSS media query, bars retain title text"

patterns-established:
  - "flattenTree pattern: recursive tree flattening with expand/collapse set for gantt rendering"

requirements-completed: [TL-01, TL-02, TL-03, TL-04, TL-05, TL-06]

duration: 3min
completed: 2026-04-09
---

# Phase 18 Plan 01: Timeline Gantt Rewrite Summary

**Rewrote timeline from horizon swim-lanes to a proper Gantt tree chart with indented rows, horizontal bars with progress fill, collapsible branches, and sticky tree panel**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T12:13:50Z
- **Completed:** 2026-04-09T12:16:34Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced four horizon swim lanes with a single tree hierarchy showing parent > child relationships via indentation
- Horizontal Gantt bars with category color, progress fill overlay, and dashed borders for date-less goals
- Single click on any bar or tree row opens GoalDetail panel (removed the two-click Collapsible popup pattern)
- Sticky left tree panel (240px) stays pinned during horizontal scroll on month zoom
- Container constrained to viewport height via max-height calc

## Task Commits

Each task was committed atomically:

1. **Task 1: Add flattenTree helper and FlatTimelineRow type** - `1f0db3a` (feat)
2. **Task 2: Rewrite GoalTimelineView and GoalTimelineNode as Gantt tree** - `93168a2` (feat)

## Files Created/Modified
- `lib/timeline-utils.ts` - Added FlatTimelineRow interface and flattenTree function; removed flattenByHorizon and TimelineGoal
- `components/goals/goal-timeline-view.tsx` - Full rewrite: single CSS Grid Gantt with tree panel, useGoalTree + filterTree data flow, local expand state
- `components/goals/goal-timeline-node.tsx` - Full rewrite: two-cell Fragment (sticky tree label + bar area) replacing Collapsible popup node

## Decisions Made
- Used single CSS Grid with sticky positioning (not split-panel with JS scroll sync) for zero-jank row alignment
- Expand/collapse state kept in local useState rather than Zustand since it does not need to persist across sessions
- Re-initialize expanded IDs via useEffect when tree data first loads (useState initializer runs before React Query resolves)
- Mobile breakpoint hides tree panel column entirely; bar titles provide goal identification on small screens

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added tree data re-initialization on first load**
- **Found during:** Task 2 (GoalTimelineView rewrite)
- **Issue:** useState initializer for expandedIds runs before useGoalTree resolves, so the initial set is empty. First two levels would not auto-expand.
- **Fix:** Added a useEffect with a ref guard that populates expandedIds when tree data first becomes available
- **Files modified:** components/goals/goal-timeline-view.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 93168a2 (part of task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correct expand/collapse behavior on initial render. No scope creep.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Timeline Gantt layout is complete, ready for Plan 02 (navigation polish)
- All zoom levels (Year/Quarter/Month) render correctly with the new tree structure
- The flattenTree utility is reusable for any future tree-to-flat-row rendering needs

---
*Phase: 18-timeline-nav-polish*
*Completed: 9. 4. 2026*
