---
phase: 02-app-shell-and-goal-management
plan: 01
subsystem: ui
tags: [shadcn-ui, next-themes, react-query, zustand, tailwindcss, oklch, theming]

requires:
  - phase: 01-foundation
    provides: Next.js app with Prisma schema, service layer, API routes, and Zod validations

provides:
  - ThemeProvider with dark/light/system theme switching
  - QueryProvider with React Query cache (30s staleTime)
  - Zustand UI store for sidebar, goal modal, and selected goal state
  - Query key factory for type-safe cache invalidation
  - Full NativeAI color palette (indigo/violet) in oklch for both themes
  - Three font families (Inter, Playfair Display, JetBrains Mono)
  - 17 shadcn/ui components ready for use

affects: [02-app-shell-and-goal-management, 03-dashboard-and-views, 04-progress-tracking-and-xp]

tech-stack:
  added: ["@tanstack/react-query@5.95", "@tanstack/react-query-devtools@5.95", "zustand@5.0", "next-themes@0.4", "sonner@2.0", "lucide-react@1.7", "shadcn/ui (17 components)"]
  patterns: ["QueryClient useState singleton", "Zustand persist with partialize", "CSS custom properties with oklch", "next-themes class attribute strategy"]

key-files:
  created:
    - components/providers/theme-provider.tsx
    - components/providers/query-provider.tsx
    - lib/queries/keys.ts
    - lib/stores/ui-store.ts
    - components/ui/sidebar.tsx
    - components/ui/dialog.tsx
    - components/ui/sheet.tsx
    - components/ui/alert-dialog.tsx
    - hooks/use-mobile.ts
  modified:
    - app/globals.css
    - app/layout.tsx

key-decisions:
  - "NativeAI palette uses indigo as primary in light mode and violet as primary in dark mode for visual distinction"
  - "Zustand persist middleware only saves sidebarCollapsed to localStorage via partialize; transient state (selectedGoalId, modalOpen) does not persist"
  - "QueryClient uses useState singleton pattern to prevent cache leak across server requests in Next.js App Router"
  - "shadcn/ui components installed via codegen (not npm) for full control over component source"

patterns-established:
  - "Provider composition: ThemeProvider > QueryProvider > children + Toaster"
  - "Query key factory: queryKeys.goals.list(filters) returns typed readonly tuple"
  - "CSS variable theming: :root (light) and .dark selectors with oklch values, mapped via @theme inline"
  - "Font setup: three next/font/google instances with CSS variables mapped in @theme inline"

requirements-completed: [THEME-01, THEME-02, THEME-03, THEME-04]

duration: 5min
completed: 2026-03-30
---

# Phase 2 Plan 1: Dependencies, Theme, and Provider Setup Summary

**NativeAI indigo/violet palette with oklch theming, React Query + Zustand state management, and 17 shadcn/ui components installed as the foundation for all Phase 2 UI work**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T16:18:59Z
- **Completed:** 2026-03-30T16:24:13Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- Installed all Phase 2 dependencies and initialized shadcn/ui with 17 components (sidebar, sheet, dialog, alert-dialog, button, input, textarea, select, sonner, badge, label, tabs, separator, skeleton, dropdown-menu, tooltip, collapsible)
- Replaced default zinc palette with full NativeAI color system using oklch values, with indigo primary in light mode and violet primary in dark mode
- Set up complete provider chain in root layout: ThemeProvider (system preference default), QueryProvider (useState singleton), and Toaster
- Created Zustand UI store with persist middleware (only sidebar preference persists) and query key factory for type-safe cache management
- Configured three Google Fonts: Inter (body), Playfair Display (headlines), JetBrains Mono (data/code)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and initialize shadcn/ui** - `5157b74` (chore)
2. **Task 2: Set up theme system, providers, stores, and root layout** - `df6ee78` (feat)

## Files Created/Modified
- `app/globals.css` - Full NativeAI palette with :root (light) and .dark CSS variables in oklch
- `app/layout.tsx` - Root layout with ThemeProvider, QueryProvider, Toaster, three Google Fonts
- `components/providers/theme-provider.tsx` - Client boundary wrapping next-themes
- `components/providers/query-provider.tsx` - Client boundary with useState QueryClient singleton
- `lib/queries/keys.ts` - Query key factory for goals and categories
- `lib/stores/ui-store.ts` - Zustand store for sidebar, goal modal, and selected goal state
- `components/ui/*.tsx` - 17 shadcn/ui components (sidebar, sheet, dialog, etc.)
- `hooks/use-mobile.ts` - Mobile detection hook from shadcn/ui sidebar

## Decisions Made
- NativeAI palette swaps primary/secondary between light and dark modes (indigo primary in light, violet primary in dark) for visual distinction between themes
- Zustand persist uses partialize to only save sidebarCollapsed, keeping transient UI state (selectedGoalId, modalOpen) ephemeral
- QueryClient created with useState pattern (not module-level singleton) to prevent server-side cache leaks
- Used shadcn/ui codegen approach (not npm packages) for full source control over components
- Dependencies and shadcn/ui init were already present from a prior setup commit, so Task 1 focused on adding the 16 additional components

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn/ui init already ran in prior commit**
- **Found during:** Task 1 (Install dependencies)
- **Issue:** A previous commit (dce748c) had already run shadcn/ui init and installed all npm dependencies. The package.json, components.json, button.tsx, and utils.ts were already committed.
- **Fix:** Skipped redundant install/init steps and proceeded to adding the remaining 16 shadcn/ui components which were not yet present.
- **Files modified:** None (avoided duplicate work)
- **Verification:** All components present, TypeScript compilation passes
- **Committed in:** 5157b74 (Task 1 commit)

**2. [Rule 3 - Blocking] shadcn/ui init overwrote layout.tsx with Geist font**
- **Found during:** Task 2 (Update root layout)
- **Issue:** The prior shadcn/ui init had replaced Inter with a Geist font import and `cn()` based className in layout.tsx
- **Fix:** Wrote the correct layout.tsx with Inter, Playfair Display, and JetBrains Mono fonts plus all providers
- **Files modified:** app/layout.tsx
- **Verification:** Production build passes, TypeScript compiles
- **Committed in:** df6ee78 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues from prior state)
**Impact on plan:** Both handled seamlessly. The prior init saved installation time; the Geist font override was replaced with the correct configuration.

## Issues Encountered
None beyond the deviations noted above.

## User Setup Required
None; no external service configuration required.

## Next Phase Readiness
- All providers in place: ThemeProvider, QueryProvider, Toaster, and Zustand store are ready for consumption
- 17 shadcn/ui components available for building the app shell (Plan 02-02) and goal management forms (Plan 02-03, 02-04)
- Query key factory ready for React Query hooks in subsequent plans
- Theme system follows system preference by default with manual override support

## Self-Check: PASSED

- All 24 files verified present on disk
- Both task commits (5157b74, df6ee78) verified in git log
- Production build passes
- TypeScript compilation clean

---
*Phase: 02-app-shell-and-goal-management*
*Completed: 2026-03-30*
