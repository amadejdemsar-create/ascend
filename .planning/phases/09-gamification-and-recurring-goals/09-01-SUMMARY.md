---
phase: 09-gamification-and-recurring-goals
plan: 01
subsystem: api, database, gamification
tags: [xp, levels, gamification, recurring-goals, prisma, date-fns]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Prisma schema with UserStats and XpEvent models, Service Layer pattern
  - phase: 04-dashboard-and-progress-tracking
    provides: Dashboard service consuming UserStats for stats widget
  - phase: 05-mcp-server
    provides: MCP bulk-tools calling goalService for completion
provides:
  - gamification-service.ts with awardXp and getStats methods
  - Level formula functions (xpForLevel, levelFromXp, xpToNextLevel) in constants.ts
  - RecurringFrequency enum and recurring goal fields on Goal model
  - XP award wiring in both REST API PATCH and MCP complete_goals
affects: [09-gamification-and-recurring-goals, 04-dashboard-and-progress-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns: [gamification service as plain TS object module, caller-responsible status check pattern, weekly score auto-reset]

key-files:
  created:
    - lib/services/gamification-service.ts
    - prisma/migrations/20260331150000_add_gamification_recurring/migration.sql
  modified:
    - lib/constants.ts
    - lib/validations.ts
    - prisma/schema.prisma
    - app/api/goals/[id]/route.ts
    - lib/mcp/tools/bulk-tools.ts

key-decisions:
  - "Caller-responsible pattern: API route and MCP handler check previous status before calling awardXp, keeping gamification service focused on XP logic only"
  - "Quadratic level formula: 100 * level^2 gives Level 1 at 100 XP and Level 5 at 2500 XP, providing satisfying early progression with increasing challenge"
  - "Weekly score auto-reset: gamification service detects week rollover by comparing stored weekStartDate to current Monday via date-fns startOfWeek"
  - "MCP complete_goals now skips already-completed goals instead of re-completing them, preventing duplicate XP and providing clear skip count in response"

patterns-established:
  - "Gamification caller-responsible: the service receiving the awardXp call must verify the status transition; gamification service never fetches the goal"
  - "XP result envelope: API returns goal JSON with optional _xp field only on genuine completion, allowing clients to detect and display XP awards"

requirements-completed: [GAME-01, GAME-02]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 9 Plan 1: Gamification Service and Schema Extension Summary

**XP award service with quadratic level formula, recurring goal schema, and completion wiring into both REST API and MCP bulk tools**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T14:58:09Z
- **Completed:** 2026-03-31T15:01:25Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created gamification service with awardXp (XP calculation, XpEvent creation, UserStats upsert, level detection, weekly score reset) and getStats (safe defaults, xpToNextLevel progress)
- Added level formula functions to constants.ts: xpForLevel (quadratic), levelFromXp (inverse sqrt), xpToNextLevel (progress within current level)
- Extended Prisma schema with RecurringFrequency enum and seven new fields on Goal model (isRecurring, recurringFrequency, recurringInterval, recurringSourceId, self-relation, currentStreak, longestStreak, lastCompletedInstance)
- Wired XP awards into PATCH /api/goals/[id] with previous status check and _xp response envelope
- Wired XP awards into MCP complete_goals with skip detection for already completed goals and XP total in response text

## Task Commits

Each task was committed atomically:

1. **Task 1: Gamification service, level formula, and schema extension** - `9033416` (feat)
2. **Task 2: Wire XP awards into REST API and MCP completion flows** - `ef5dbd6` (feat)

## Files Created/Modified
- `lib/services/gamification-service.ts` - XP award, level calculation, weekly score reset, stats retrieval
- `lib/constants.ts` - Added xpForLevel, levelFromXp, xpToNextLevel level formula functions
- `prisma/schema.prisma` - RecurringFrequency enum, recurring goal fields and self-relation on Goal model
- `prisma/migrations/20260331150000_add_gamification_recurring/migration.sql` - Migration SQL for new enum, columns, foreign key, and index
- `lib/validations.ts` - Added recurringFrequencyEnum and optional recurring fields to create/update goal schemas
- `app/api/goals/[id]/route.ts` - PATCH handler fetches previous status, awards XP on genuine completion, returns _xp envelope
- `lib/mcp/tools/bulk-tools.ts` - complete_goals checks previous status, skips already completed, awards XP, reports totals

## Decisions Made
- Caller-responsible pattern: API route and MCP handler check previous status before calling awardXp, keeping gamification service focused on XP logic only
- Quadratic level formula: 100 * level^2 gives satisfying early progression with increasing challenge at higher levels
- Weekly score auto-reset: gamification service detects week rollover by comparing stored weekStartDate to current Monday via date-fns startOfWeek
- MCP complete_goals now skips already-completed goals instead of re-completing them, preventing duplicate XP awards

## Deviations from Plan

None, plan executed exactly as written.

## Issues Encountered
- Prisma migrate diff requires a shadow database URL when diffing from migrations directory; wrote migration SQL manually instead (consistent with project pattern from Phase 01-02)
- Prisma 7 renamed `--from-schema-datamodel` to `--from-schema`; used correct flag

## User Setup Required

None, no external service configuration required.

## Next Phase Readiness
- Gamification service ready for recurring goals service (Plan 02) to call awardXp on recurring instance completion
- Dashboard widgets (Plan 03) can call gamificationService.getStats for XP bar, level display, and weekly score
- Celebration animations (Plan 04) can key off the _xp.leveledUp boolean from API responses

## Self-Check: PASSED

All 7 files verified on disk. Both task commits (9033416, ef5dbd6) found in git log.

---
*Phase: 09-gamification-and-recurring-goals*
*Completed: 2026-03-31*
