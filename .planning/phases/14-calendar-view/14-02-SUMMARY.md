---
phase: 14-calendar-view
plan: 02
subsystem: ui
tags: [morning-planning, big3, calendar, tanstack-query, sonner]

requires:
  - phase: 12-todo-data-layer
    provides: "useSetBig3, useTop3Todos, useTodosByDate hooks and Big 3 API"
  - phase: 14-calendar-view
    provides: "Calendar page layout with month grid and day detail panel"
provides:
  - "MorningPlanningPrompt component for daily Big 3 selection"
  - "Calendar page integration showing prompt when Big 3 are not set for today"
affects: [14-calendar-view, daily-planning-ritual]

tech-stack:
  added: []
  patterns: [inline-planning-prompt, max-selection-enforcement, conditional-prompt-display]

key-files:
  created:
    - components/calendar/morning-planning-prompt.tsx
  modified:
    - app/(app)/calendar/page.tsx

key-decisions:
  - "Inline card (not modal) for non-blocking planning experience"
  - "Max 3 enforcement via toast notification rather than disabling unselected items"
  - "promptDismissed state resets on remount so prompt reappears on next visit if Big 3 still unset"
  - "Today's todos fetched at page level and passed as props to avoid duplicate queries"

patterns-established:
  - "Conditional prompt pattern: show planning prompt based on data state (Big 3 empty) and view state (viewing today)"

requirements-completed: [CAL-07]

duration: 2min
completed: 2026-04-09
---

# Phase 14 Plan 02: Morning Planning Prompt Summary

**Non-blocking morning planning card that guides users to select their Daily Big 3 priorities when opening the calendar without Big 3 set for today**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-09T11:23:28Z
- **Completed:** 2026-04-09T11:25:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Morning planning prompt component with selectable todo list, star toggle, and max 3 enforcement
- Calendar page integration that conditionally shows the prompt only when viewing today with no Big 3 set
- Empty state handling when no pending todos exist for today
- Automatic prompt dismissal after Big 3 are set (via query refetch invalidation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Morning planning prompt component** - `000efbe` (feat)
2. **Task 2: Integrate morning prompt into calendar page** - `d2b7adf` (feat)

## Files Created/Modified
- `components/calendar/morning-planning-prompt.tsx` - Inline planning card with selectable todo list, star toggles, max 3 enforcement, and Set Big 3 / Skip actions
- `app/(app)/calendar/page.tsx` - Added morning prompt integration with today's Big 3 check, today's todos fetch, and conditional rendering

## Decisions Made
- Used inline card design (not a modal) to keep the planning prompt non-blocking, allowing users to see the calendar behind it
- Enforced max 3 selection with a toast notification ("You can only pick 3 priorities. Deselect one first.") rather than disabling unselected items, which would be less discoverable
- The promptDismissed state lives in component state (not localStorage), so it resets when the user navigates away and comes back, which is the desired behavior for a daily planning nudge
- Today's todos are fetched at the page level and passed as props to the prompt component, avoiding duplicate fetching since the calendar page may also use this data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 (Calendar View) is now complete with both plans finished
- Morning planning prompt provides the daily ritual entry point for the calendar
- Ready for Phase 15 or subsequent phases

## Self-Check: PASSED

- All 1 created file exists on disk
- All 2 task commits verified in git log
- Line count exceeds plan minimum (morning-planning-prompt: 141/50)

---
*Phase: 14-calendar-view*
*Completed: 2026-04-09*
