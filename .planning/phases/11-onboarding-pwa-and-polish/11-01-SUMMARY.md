---
phase: 11-onboarding-pwa-and-polish
plan: 01
subsystem: ui
tags: [onboarding, wizard, mcp, prisma, react, nextjs]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Prisma schema, User model, API route patterns
  - phase: 02-app-shell-and-goal-management
    provides: Dashboard page, UI components, React Query hooks
  - phase: 05-mcp-server
    provides: MCP server endpoint referenced in onboarding guide
provides:
  - onboardingComplete field on User model
  - OnboardingGate component with three-path flow (wizard, MCP guide, skip)
  - PATCH /api/goals/onboarding endpoint
  - ContextualHints component for skip-path users
  - DashboardData.onboardingComplete field
affects: [11-onboarding-pwa-and-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-step wizard with local state, polling for external goal creation, localStorage-based hint dismissal]

key-files:
  created:
    - components/onboarding/onboarding-gate.tsx
    - components/onboarding/onboarding-choice.tsx
    - components/onboarding/onboarding-wizard.tsx
    - components/onboarding/onboarding-mcp-guide.tsx
    - components/onboarding/contextual-hints.tsx
    - app/api/goals/onboarding/route.ts
    - prisma/migrations/20260331191400_add_onboarding_complete/migration.sql
  modified:
    - prisma/schema.prisma
    - lib/services/dashboard-service.ts
    - components/dashboard/dashboard-page.tsx

key-decisions:
  - "Migration uses DEFAULT true for existing rows so seeded test user is treated as already onboarded"
  - "onboardingComplete fetched in batch 2 of Promise.all alongside existing queries for zero extra roundtrips"
  - "Skip path calls onComplete immediately and shows contextual hints on the empty dashboard state"
  - "MCP guide polls /api/dashboard every 5 seconds to detect goals created via external MCP tools"

patterns-established:
  - "Onboarding gate pattern: conditional render in dashboard based on onboardingComplete flag"
  - "Multi-step wizard with inline API calls using existing fetch pattern"

requirements-completed: [ONBD-01, ONBD-02, ONBD-03, ONBD-04]

# Metrics
duration: 10min
completed: 2026-03-31
---

# Phase 11 Plan 01: Onboarding Summary

**Three-path onboarding flow (guided wizard, MCP guide, skip) with Prisma migration and dashboard integration**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-31T19:13:47Z
- **Completed:** 2026-03-31T19:24:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added onboardingComplete field to User model with migration that marks existing users as already onboarded
- Built three-path onboarding choice screen (Guided Setup, AI-Guided Setup, Skip for Now)
- Implemented multi-step wizard that creates a category, yearly goal, and quarterly sub-goal through existing API endpoints
- Created MCP guide with config copy, polling for goal detection, and manual override
- Added contextual hints for users who skip onboarding, dismissible via localStorage

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration, onboarding API, and dashboard data extension** - `88f3e08` (feat)
2. **Task 2: Onboarding gate, three-path choice, wizard, MCP guide, skip with hints** - `fe1d25e` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added onboardingComplete Boolean field to User model
- `prisma/migrations/20260331191400_add_onboarding_complete/migration.sql` - Migration with DEFAULT true for existing rows
- `lib/services/dashboard-service.ts` - Added onboardingComplete to DashboardData type and query
- `app/api/goals/onboarding/route.ts` - PATCH endpoint to mark onboarding complete
- `components/onboarding/onboarding-gate.tsx` - Gate component routing to selected onboarding path
- `components/onboarding/onboarding-choice.tsx` - Three-card choice screen with icons
- `components/onboarding/onboarding-wizard.tsx` - Four-step wizard (welcome, category, yearly goal, quarterly goal)
- `components/onboarding/onboarding-mcp-guide.tsx` - MCP config display with polling and copy button
- `components/onboarding/contextual-hints.tsx` - Dismissible hint cards for skip-path users
- `components/dashboard/dashboard-page.tsx` - Integrated OnboardingGate and ContextualHints

## Decisions Made
- Migration uses DEFAULT true for existing rows so the seeded test user (and any future seeded users) are treated as already onboarded, while new users get false by default from the schema
- onboardingComplete is fetched in Promise.all batch 2 alongside existing stats queries to avoid an extra database roundtrip
- Skip path immediately calls onComplete (marks onboarding done) and renders contextual hints on the empty dashboard rather than showing a separate skip confirmation
- MCP guide polls the dashboard endpoint every 5 seconds and detects goals via totalGoals > 0, with a manual "I am done" fallback button

## Deviations from Plan

None. Plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None. No external service configuration required.

## Next Phase Readiness
- Onboarding flow complete and integrated into the dashboard
- Ready for Plan 02 (PWA manifest and service worker) to proceed independently
- The onboardingComplete field is available for any future plans that need to check first-time user status

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (88f3e08, fe1d25e) found in git log.

---
*Phase: 11-onboarding-pwa-and-polish*
*Completed: 2026-03-31*
