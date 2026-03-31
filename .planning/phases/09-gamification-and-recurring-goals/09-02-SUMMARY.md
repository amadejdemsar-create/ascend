---
phase: 09-gamification-and-recurring-goals
plan: 02
subsystem: api, ui, recurring-goals
tags: [recurring-goals, streaks, date-fns, instance-generation, goal-form]

# Dependency graph
requires:
  - phase: 09-gamification-and-recurring-goals
    provides: Gamification service with awardXp, RecurringFrequency enum, recurring fields on Goal model
  - phase: 01-foundation
    provides: Prisma schema, Service Layer pattern, Goal model
  - phase: 02-app-shell-and-goal-management
    provides: Goal form, goal detail view, shadcn UI components
provides:
  - recurring-service.ts with generateDueInstances, completeRecurringInstance, listTemplates
  - GET /api/goals/recurring endpoint for listing recurring templates
  - POST /api/goals/recurring/generate endpoint for creating due instances
  - Recurring toggle and frequency/interval fields in goal creation form
  - Streak info display (current/longest) for recurring templates in goal detail
  - Instance of template navigation link for recurring instances
  - Streak update wiring in PATCH goal completion flow
affects: [09-gamification-and-recurring-goals, 04-dashboard-and-progress-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy instance generation, streak tracking on template goal, grace period for daily recurring]

key-files:
  created:
    - lib/services/recurring-service.ts
    - app/api/goals/recurring/route.ts
    - app/api/goals/recurring/generate/route.ts
  modified:
    - components/goals/goal-form.tsx
    - components/goals/goal-detail.tsx
    - app/api/goals/[id]/route.ts

key-decisions:
  - "Lazy generation pattern: instances are created on demand when dashboard calls /generate, not on a cron schedule"
  - "Grace period for daily recurring: streak is only broken if today exceeds nextDueDate + 1 day, giving users until end of next day"
  - "Instance title includes date range label (Week of Mar 31, January 2026) for clear identification"
  - "Inline switch toggle using native button role=switch instead of adding a Switch UI component dependency"
  - "Streak update wired into existing PATCH handler via recurringService.completeRecurringInstance, returned as _streak field alongside _xp"

patterns-established:
  - "Recurring template pattern: isRecurring=true with recurringSourceId=null identifies templates; instances have recurringSourceId set"
  - "Streak tracking on template: currentStreak/longestStreak/lastCompletedInstance maintained on the template goal, not on individual instances"

requirements-completed: [GOAL-10, GAME-03]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 9 Plan 2: Recurring Goals System Summary

**Lazy instance generation service with streak tracking, two API routes, and recurring goal toggle in form with streak display in detail view**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T15:04:45Z
- **Completed:** 2026-03-31T15:08:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created recurring-service.ts with lazy instance generation (copies title with date label, horizon, priority, categoryId, parentId from template), streak broken detection with grace period for daily goals, streak increment on completion, and template listing with latest instance info
- Added two API routes following the thin handler pattern: GET /api/goals/recurring for listing templates and POST /api/goals/recurring/generate for triggering instance creation
- Extended goal form with a recurring toggle (visible for WEEKLY/MONTHLY horizons) that reveals frequency select and interval input, all wired to createGoalSchema fields
- Enhanced goal detail with recurring template badge (frequency label), streak display (current/best with flame icons), and "Instance of template" navigation link for instances
- Wired recurringService.completeRecurringInstance into the existing PATCH handler alongside XP awards, returning _streak data in the response envelope

## Task Commits

Each task was committed atomically:

1. **Task 1: Recurring service with instance generation and streak tracking** - `e080ab5` (feat)
2. **Task 2: Recurring goal UI in goal form and detail view** - `d866914` (feat)

## Files Created/Modified
- `lib/services/recurring-service.ts` - Instance generation, streak tracking, template listing, date utility functions
- `app/api/goals/recurring/route.ts` - GET endpoint for listing recurring templates
- `app/api/goals/recurring/generate/route.ts` - POST endpoint for triggering instance generation
- `components/goals/goal-form.tsx` - Recurring toggle, frequency select, interval input for WEEKLY/MONTHLY horizons
- `components/goals/goal-detail.tsx` - Recurring badge, streak info (current/best), instance of template link
- `app/api/goals/[id]/route.ts` - Wire completeRecurringInstance into PATCH completion flow with _streak response

## Decisions Made
- Lazy generation pattern: instances are created on demand when the dashboard calls /generate, avoiding cron job complexity
- Grace period for daily recurring: streak is only broken if today exceeds nextDueDate + 1 day, giving users until end of next day to complete
- Instance title includes date range label (e.g., "Week of Mar 31", "January 2026") for clear identification in lists
- Inline switch toggle using native button with role=switch instead of adding a Switch UI component, keeping the component surface minimal
- Streak update wired into existing PATCH handler via recurringService.completeRecurringInstance, returned as _streak field alongside _xp

## Deviations from Plan

None, plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None, no external service configuration required.

## Next Phase Readiness
- Recurring service ready for dashboard widgets (Plan 03) to call generateDueInstances on load and display streak data
- Celebration animations (Plan 04) can key off _streak data from API responses to show streak milestones
- MCP tools could be extended to support recurring template creation and instance generation in future plans

## Self-Check: PASSED

All 6 files verified on disk. Both task commits (e080ab5, d866914) found in git log.

---
*Phase: 09-gamification-and-recurring-goals*
*Completed: 2026-03-31*
