---
phase: 11-onboarding-pwa-and-polish
plan: 04
subsystem: ui
tags: [react, view-transitions, css-animations, hooks, dashboard]

requires:
  - phase: 09-gamification
    provides: StatsData with XP, level, streak, and weekly score fields
provides:
  - ViewTransition wrapper for cross-fade page transitions
  - useAnimatedCounter hook for number animation with easing
  - CSS hover-lift, hover-glow, and progress-bar-animated utility classes
  - Animated dashboard stat counters
affects: []

tech-stack:
  added: []
  patterns: [view-transition-api, animated-counter-hook, css-micro-interactions]

key-files:
  created:
    - lib/hooks/use-animated-counter.ts
  modified:
    - app/(app)/layout.tsx
    - app/globals.css
    - components/dashboard/streaks-stats-widget.tsx
    - components/dashboard/progress-overview-widget.tsx
    - components/goals/goal-card.tsx

key-decisions:
  - "Keep completionRate as raw non-animated value since percentage animation looks odd"
  - "Skip hover-lift on board card to avoid dnd-kit transform conflicts"
  - "Animated counter respects prefers-reduced-motion by setting value instantly"

patterns-established:
  - "useAnimatedCounter: ease-out cubic hook with requestAnimationFrame, respects prefers-reduced-motion"
  - "CSS micro-interaction classes (hover-lift, hover-glow, progress-bar-animated) as reusable utilities in globals.css"

requirements-completed: [THEME-05]

duration: 9min
completed: 2026-03-31
---

# Phase 11 Plan 04: Animations & Micro-interactions Summary

**ViewTransition page cross-fades, animated stat counters with ease-out cubic easing, CSS hover-lift on cards, and smooth progress bar transitions**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T19:13:43Z
- **Completed:** 2026-03-31T19:23:04Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ViewTransition component wraps app layout children for native browser page cross-fades
- Dashboard stat numbers (level, weekly score, streaks, completed counts) animate from zero on render using useAnimatedCounter hook
- Progress bars in dashboard and goal cards animate width changes via CSS transition
- Cards have subtle hover-lift effect with translateY and shadow increase

## Task Commits

Each task was committed atomically:

1. **Task 1: ViewTransition setup, animated counter hook, and CSS animations** - `bcc744c` (feat)
2. **Task 2: Animated dashboard widgets and hover effects on cards** - `14e0c5f` (feat)

## Files Created/Modified
- `lib/hooks/use-animated-counter.ts` - Hook for animating numbers with ease-out cubic easing and reduced-motion support
- `app/(app)/layout.tsx` - Added ViewTransition wrapper around children
- `app/globals.css` - View transition keyframes, hover-lift, hover-glow, progress-bar-animated classes
- `next.config.ts` - experimental.viewTransition already enabled by Plan 02 (no change needed)
- `components/dashboard/streaks-stats-widget.tsx` - Wired animated counters for all stat values except completionRate
- `components/dashboard/progress-overview-widget.tsx` - Added progress-bar-animated and hover-lift
- `components/goals/goal-card.tsx` - Added hover-lift and progress-bar-animated

## Decisions Made
- Kept completionRate as a raw non-animated number because percentage values animating from zero look distracting
- Skipped hover-lift on GoalBoardCard because dnd-kit useSortable applies its own transforms that would conflict
- useAnimatedCounter checks `prefers-reduced-motion: reduce` at animation start and sets value instantly when enabled

## Deviations from Plan

None. The plan specified adding `experimental.viewTransition: true` to next.config.ts, but it was already present from Plan 11-02 (which added it alongside sw.js headers). The file did not need modification. All other work executed exactly as planned.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- All animations are CSS-driven and performant with no JavaScript runtime overhead beyond the counter hook
- ViewTransition provides graceful degradation (no-op in unsupported browsers)
- Ready for Plan 05 or any remaining polish tasks

## Self-Check: PASSED

All 6 created/modified files verified on disk. Both task commits (bcc744c, 14e0c5f) verified in git log.

---
*Phase: 11-onboarding-pwa-and-polish*
*Completed: 2026-03-31*
