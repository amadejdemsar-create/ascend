---
phase: 11-onboarding-pwa-and-polish
plan: 02
subsystem: pwa
tags: [pwa, service-worker, manifest, install-prompt, sharp, icons]

# Dependency graph
requires:
  - phase: 02-app-shell-and-goal-management
    provides: Root layout, Button/Card UI components, theming
provides:
  - Dynamic web manifest with MetadataRoute.Manifest type
  - Service worker with install/activate/fetch lifecycle
  - PWA icons (192x192, 512x512, maskable 512x512)
  - Service worker registration client component
  - Install prompt banner with beforeinstallprompt support
  - Cache-Control headers for sw.js in next.config.ts
affects: [11-03-offline-caching]

# Tech tracking
tech-stack:
  added: [sharp (icon generation script, not runtime)]
  patterns: [beforeinstallprompt event handling, service worker registration in useEffect, localStorage dismiss persistence]

key-files:
  created:
    - app/manifest.ts
    - public/sw.js
    - public/icons/icon-192x192.png
    - public/icons/icon-512x512.png
    - public/icons/icon-maskable-512x512.png
    - components/pwa/sw-registration.tsx
    - components/pwa/install-prompt.tsx
    - scripts/generate-pwa-icons.mjs
  modified:
    - next.config.ts
    - app/layout.tsx

key-decisions:
  - "Minimal service worker that passes through all fetch requests; caching strategies deferred to Plan 03"
  - "Generated PWA icons via sharp script committed as static PNGs rather than runtime SVG conversion"
  - "Install prompt positioned above mobile tab bar (bottom-16) with localStorage dismissal persistence"

patterns-established:
  - "PWA components as client components returning null rendered in server layout via composition"
  - "Service worker Cache-Control: no-cache headers via next.config.ts async headers()"

requirements-completed: [PWA-01, PWA-02]

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 11 Plan 02: PWA Setup Summary

**Installable PWA with dynamic manifest, violet/arrow icons, service worker lifecycle, and beforeinstallprompt install banner**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T19:14:03Z
- **Completed:** 2026-03-31T19:20:13Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- App serves a valid web manifest with standalone display, violet theme color, and three properly sized icons
- Service worker registers on page load with no-cache headers preventing stale worker scripts
- Install prompt banner appears on eligible browsers (Chrome/Edge) with dismiss to localStorage

## Task Commits

Each task was committed atomically:

1. **Task 1: PWA manifest, icons, and next.config.ts headers** - `35db08e` (feat)
2. **Task 2: Service worker, registration component, and install prompt** - `d05ea2a` (feat)

## Files Created/Modified
- `app/manifest.ts` - Dynamic PWA manifest with MetadataRoute.Manifest type
- `public/sw.js` - Service worker with install/activate/fetch handlers (pass-through fetch)
- `public/icons/icon-192x192.png` - 192x192 violet icon with white upward arrow
- `public/icons/icon-512x512.png` - 512x512 violet icon with white upward arrow
- `public/icons/icon-maskable-512x512.png` - 512x512 maskable icon (no rounded corners)
- `components/pwa/sw-registration.tsx` - Client component that registers sw.js on mount
- `components/pwa/install-prompt.tsx` - Install banner with beforeinstallprompt + dismiss
- `scripts/generate-pwa-icons.mjs` - Node.js script using sharp to generate PWA icons from SVG
- `next.config.ts` - Added Cache-Control and Content-Type headers for /sw.js
- `app/layout.tsx` - Added ServiceWorkerRegistration and InstallPrompt components

## Decisions Made
- Kept the service worker minimal (pass-through fetch) since Plan 03 adds caching strategies
- Used sharp (available as Next.js transitive dependency) for icon generation rather than adding a new dependency
- Install prompt uses fixed positioning with bottom-16 on mobile to sit above the existing tab bar

## Deviations from Plan

None, plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None, no external service configuration required.

## Next Phase Readiness
- Service worker is registered and ready for caching strategies in Plan 03
- Manifest and icons are served correctly for browser install eligibility
- InstallPrompt component handles the full install flow for Chrome/Edge

## Self-Check: PASSED

All 8 created files verified on disk. Both task commits (35db08e, d05ea2a) found in git log.

---
*Phase: 11-onboarding-pwa-and-polish*
*Completed: 2026-03-31*
