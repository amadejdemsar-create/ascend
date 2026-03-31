---
phase: 11-onboarding-pwa-and-polish
plan: 05
subsystem: ui, accessibility, pwa
tags: [css, reduced-motion, accessibility, offline, pwa, connectivity]

# Dependency graph
requires:
  - phase: 11-03
    provides: "Offline outbox with getPendingCount for pending mutation tracking"
  - phase: 11-04
    provides: "View transition animations, hover effects, progress bar classes, animated counter hook"
provides:
  - "Reduced motion CSS overrides for all animation classes"
  - "Offline connectivity indicator component with pending sync count"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["prefers-reduced-motion CSS media query overrides", "navigator.onLine event listeners for connectivity state", "IndexedDB polling for pending mutation count"]

key-files:
  created: ["components/pwa/offline-indicator.tsx"]
  modified: ["app/globals.css", "app/(app)/layout.tsx"]

key-decisions:
  - "Scoped reduced motion overrides to specific animation classes rather than wildcard * selector to avoid breaking essential layout"
  - "Offline indicator uses fixed positioning with z-50 to overlay above all content"
  - "Reconnection message auto-dismisses after 2 seconds for unobtrusive feedback"

patterns-established:
  - "Reduced motion override pattern: target animation classes explicitly in @media block rather than global wildcard"
  - "Connectivity state tracking: useState + window event listeners for online/offline with wasOffline ref for transition detection"

requirements-completed: [PWA-03, PWA-04, THEME-05]

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 11 Plan 05: Reduced Motion and Offline Indicator Summary

**Reduced motion CSS overrides for all animation classes plus offline connectivity banner with pending outbox count**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T19:43:02Z
- **Completed:** 2026-03-31T19:44:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- All view transitions, hover effects, and progress bar animations disabled when user prefers reduced motion via CSS media query
- Verified existing hooks (useAnimatedCounter, useCelebrations) already respect reduced motion settings
- Offline indicator component shows amber banner with pending sync count when connectivity is lost, and brief emerald reconnection confirmation

## Task Commits

Each task was committed atomically:

1. **Task 1: Reduced motion CSS overrides and animation hook verification** - `2f47484` (feat)
2. **Task 2: Offline connectivity indicator** - `4c38784` (feat)

## Files Created/Modified
- `app/globals.css` - Added @media (prefers-reduced-motion: reduce) block disabling view transitions, hover lifts, hover glows, and progress bar animations
- `components/pwa/offline-indicator.tsx` - New component tracking connectivity state with pending outbox count polling
- `app/(app)/layout.tsx` - Integrated OfflineIndicator above main content in SidebarInset

## Decisions Made
- Scoped reduced motion CSS to specific animation classes (.hover-lift, .hover-glow, .progress-bar-animated, ::view-transition) rather than using a wildcard selector, which avoids breaking essential layout transitions
- Offline indicator uses fixed top positioning (z-50) so it appears above all content without affecting layout flow
- Reconnection "Back online, syncing..." message shows for 2 seconds then auto-dismisses
- Polls pending count every 3 seconds while offline so the count updates as the user continues making changes

## Deviations from Plan

None, plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None, no external service configuration required.

## Next Phase Readiness
This is the final plan in Phase 11 (the last phase of the project). All 11 phases are now complete. The application has full PWA support with offline caching, sync, reduced motion accessibility, and connectivity indicators.

## Self-Check: PASSED

All files verified present on disk. All commit hashes found in git log.

---
*Phase: 11-onboarding-pwa-and-polish*
*Completed: 2026-03-31*
