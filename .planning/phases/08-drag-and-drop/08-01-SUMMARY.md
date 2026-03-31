---
phase: 08-drag-and-drop
plan: 01
subsystem: ui, api
tags: [dnd-kit, react, drag-and-drop, batch-reorder, prisma-transaction]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Prisma schema with Goal model and sortOrder field
  - phase: 02-app-shell-and-goal-management
    provides: useUpdateGoal mutation hook and fetchJson helper
provides:
  - "@dnd-kit/react and @dnd-kit/helpers installed"
  - "POST /api/goals/reorder batch endpoint"
  - "goalService.reorderGoals with $transaction"
  - "useReorderGoals mutation hook"
  - "GoalDragOverlay ghost card component"
  - "DndGoalProvider wrapper with DragOverlay"
affects: [08-drag-and-drop]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/react@0.3.2", "@dnd-kit/helpers"]
  patterns: ["DndGoalProvider wrapper for shared drag lifecycle", "Parameters<EventType>[0] for extracting dnd-kit event arg types"]

key-files:
  created:
    - app/api/goals/reorder/route.ts
    - components/goals/goal-drag-overlay.tsx
    - components/goals/dnd-goal-provider.tsx
  modified:
    - lib/validations.ts
    - lib/services/goal-service.ts
    - lib/hooks/use-goals.ts
    - package.json

key-decisions:
  - "Used Parameters<DragStartEvent>[0] type extraction because @dnd-kit/react exports event types as full function signatures, not event object types"
  - "Made updateGoalSchema parentId nullable to support detaching goals from parents on horizon change"
  - "DndGoalProvider is intentionally minimal; individual views in Plans 02 and 03 handle their own sortable reorder logic"

patterns-established:
  - "DndGoalProvider wrapper: shared DragDropProvider with overlay and cross-column mutation dispatch"
  - "Batch reorder pattern: POST /api/goals/reorder with Prisma $transaction for atomic sortOrder updates"

requirements-completed: [DND-01, DND-05]

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 08 Plan 01: DnD Foundation Summary

**Installed @dnd-kit/react, created batch reorder API with Prisma transaction, built shared DndGoalProvider wrapper with ghost card overlay for all drag-and-drop views**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T14:21:27Z
- **Completed:** 2026-03-31T14:26:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed @dnd-kit/react and @dnd-kit/helpers as the drag-and-drop foundation
- Built batch reorder endpoint (POST /api/goals/reorder) with Prisma $transaction for atomic sortOrder updates
- Created shared DndGoalProvider wrapper that manages drag lifecycle, overlay rendering, and cross-column mutation dispatch for horizon and category changes
- Added GoalDragOverlay ghost card component showing title, priority badge, and category dot during drag

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dnd-kit, add batch reorder service method, API endpoint, and mutation hook** - `c143ad1` (feat)
2. **Task 2: Create GoalDragOverlay and DndGoalProvider wrapper** - `27182d9` (feat)

## Files Created/Modified
- `app/api/goals/reorder/route.ts` - POST endpoint for batch sortOrder updates with auth and validation
- `components/goals/goal-drag-overlay.tsx` - Ghost card component with title, priority badge, and category dot
- `components/goals/dnd-goal-provider.tsx` - Shared DragDropProvider wrapper with drag overlay and event handlers
- `lib/validations.ts` - Added reorderGoalsSchema and made updateGoalSchema parentId nullable
- `lib/services/goal-service.ts` - Added reorderGoals method with $transaction batch update
- `lib/hooks/use-goals.ts` - Added useReorderGoals mutation hook with query invalidation
- `package.json` - Added @dnd-kit/react and @dnd-kit/helpers dependencies

## Decisions Made
- Used `Parameters<DragStartEvent>[0]` type extraction because @dnd-kit/react exports event types as full function signatures (`(event, manager) => void`), not standalone event object types. This is a reliable pattern for extracting the parameter type.
- Made `updateGoalSchema` accept `parentId: null` to support detaching goals from parent when changing horizons via drag. Previously only accepted `string | undefined`.
- DndGoalProvider is intentionally minimal for this plan. It handles drag start (overlay data capture) and drag end (cross-column horizon/category mutations). Individual views in Plans 02 and 03 will manage their own sortable reorder logic because each view has different local state management needs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made updateGoalSchema parentId nullable**
- **Found during:** Task 2 (DndGoalProvider implementation)
- **Issue:** The plan's horizon change handler passes `parentId: null` to detach from parent, but `updateGoalSchema` only accepted `string | undefined` for parentId (inherited from `createGoalSchema.partial()`)
- **Fix:** Added explicit `parentId: z.string().nullable().optional()` override in `updateGoalSchema`
- **Files modified:** lib/validations.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 27182d9 (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed dnd-kit event type usage**
- **Found during:** Task 2 (DndGoalProvider implementation)
- **Issue:** `DragStartEvent` and `DragEndEvent` from @dnd-kit/react are function type aliases for the full callback signature, not event object types. Using them directly as parameter types caused TypeScript errors.
- **Fix:** Used `Parameters<DragStartEvent>[0]` and `Parameters<DragEndEvent>[0]` to extract the actual event object types, and cast horizon string to the enum union type
- **Files modified:** components/goals/dnd-goal-provider.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 27182d9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed type issues documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DnD foundation is complete and ready for Plans 02 and 03
- DndGoalProvider, GoalDragOverlay, and useReorderGoals are all exported and available for import
- Plan 02 can wire sortable goals in list and board views using the shared infrastructure
- Plan 03 can add tree view drag-and-drop with the same provider and overlay

## Self-Check: PASSED

All 4 created files verified on disk. Both task commits (c143ad1, 27182d9) verified in git log.

---
*Phase: 08-drag-and-drop*
*Completed: 2026-03-31*
