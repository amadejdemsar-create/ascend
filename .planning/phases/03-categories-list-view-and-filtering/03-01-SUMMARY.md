---
phase: 03-categories-list-view-and-filtering
plan: 01
subsystem: ui, api
tags: [react, lucide-react, shadcn, prisma, react-query, categories]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Prisma Category model, validation schemas, query keys
  - phase: 02-app-shell-and-goal-management
    provides: fetchJson pattern, shadcn UI components, React Query setup
provides:
  - Category mutation hooks (useCreateCategory, useUpdateCategory, useDeleteCategory)
  - CategoryForm component with color picker and icon picker
  - CATEGORY_COLORS and DEFAULT_CATEGORIES constants
  - Default category seeding in prisma/seed.ts
affects: [03-categories-list-view-and-filtering, 04-goal-category-integration]

# Tech tracking
tech-stack:
  added: [shadcn popover (base-ui)]
  patterns: [controlled icon picker with search, preset color swatch palette]

key-files:
  created:
    - components/categories/category-form.tsx
    - components/categories/category-color-picker.tsx
    - components/categories/category-icon-picker.tsx
    - components/ui/popover.tsx
  modified:
    - lib/hooks/use-categories.ts
    - lib/constants.ts
    - prisma/seed.ts

key-decisions:
  - "Used findFirst + create pattern for category seeding instead of upsert because PostgreSQL NULL != NULL in composite unique constraints prevents matching on nullable parentId"
  - "DynamicIcon from lucide-react/dynamic for runtime icon rendering by name string"
  - "Curated 20 default icons shown when search is empty, full 1941 icon set searchable"

patterns-established:
  - "Category CRUD hooks follow identical fetchJson + useMutation + invalidation pattern as goal hooks"
  - "Controlled component pattern for color and icon pickers with value/onChange API"

requirements-completed: [CAT-01, CAT-06]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 03 Plan 01: Category CRUD Hooks, Form, and Seed Summary

**Category mutation hooks with React Query, reusable form component with preset color picker and searchable Lucide icon picker, and 5 default category seeds**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T21:17:54Z
- **Completed:** 2026-03-30T21:22:34Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Category mutation hooks (create, update, delete) with proper cache invalidation including cross-entity invalidation on delete
- Preset color picker with 8 swatches and visual check overlay for selection state
- Searchable icon picker using DynamicIcon from lucide-react/dynamic, showing 20 curated defaults with search across all 1941 Lucide icons
- CategoryForm supporting both create and edit modes with name, color, icon, and optional parent category select
- 5 default categories (Business, Personal, Health, Finance, Learning) seeded idempotently

## Task Commits

Each task was committed atomically:

1. **Task 1: Category mutation hooks and default categories seed** - `447f8a7` (feat)
2. **Task 2: Category color picker, icon picker, and form components** - `037d43b` (feat)

## Files Created/Modified
- `lib/hooks/use-categories.ts` - Refactored to fetchJson pattern, added useCreateCategory, useUpdateCategory, useDeleteCategory
- `lib/constants.ts` - Added CATEGORY_COLORS (8 preset hex swatches) and DEFAULT_CATEGORIES (5 defaults with icons)
- `prisma/seed.ts` - Added idempotent seeding of 5 default categories per user
- `components/categories/category-color-picker.tsx` - Controlled color swatch grid component
- `components/categories/category-icon-picker.tsx` - Searchable Lucide icon grid in a base-ui Popover
- `components/categories/category-form.tsx` - Create/edit form composing name, color picker, icon picker, parent select
- `components/ui/popover.tsx` - shadcn Popover component (base-ui)

## Decisions Made
- Used findFirst + create pattern for category seeding instead of Prisma upsert because the composite unique `[userId, name, parentId]` has nullable parentId, and PostgreSQL treats NULL != NULL, preventing upsert matching on top-level categories
- Used `DynamicIcon` from `lucide-react/dynamic` for runtime icon rendering by name string, which supports lazy loading of icon definitions
- Curated 20 default icons for the empty search state to keep the initial view focused and relevant

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed shadcn Popover component**
- **Found during:** Task 2 (icon picker requires Popover)
- **Issue:** Popover component was not yet installed, needed for icon picker UI
- **Fix:** Ran `npx shadcn@latest add popover` to generate the base-ui Popover component
- **Files modified:** components/ui/popover.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 037d43b (Task 2 commit)

**2. [Rule 1 - Bug] Fixed seed script NULL handling for composite unique**
- **Found during:** Task 1 (seed script for categories)
- **Issue:** Plan specified upsert by `[userId, name, parentId]` but parentId is NULL for top-level categories, and Prisma compound unique requires string type
- **Fix:** Used findFirst + conditional create pattern instead of upsert
- **Files modified:** prisma/seed.ts
- **Verification:** TypeScript compilation passes, logic verified
- **Committed in:** 447f8a7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Category hooks and form components are ready to be wired into the sidebar (plan 02) and category management page (plan 03)
- All components follow the same patterns as existing goal components for consistency

---
*Phase: 03-categories-list-view-and-filtering*
*Completed: 2026-03-30*
