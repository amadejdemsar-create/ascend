# Goal Progress Auto-Calculation from Children

**Slug**: goal-progress-auto-calc
**Created**: 13. 4. 2026
**Status**: planning

## Problem

Goal progress is currently manual-only. A user sets `progress: 43` by hand or uses the ProgressIncrement component on goals with a `targetValue`. But parent goals have no automatic awareness of their children's completion state. If a Yearly goal has 4 Quarterly children and 2 are completed, the Yearly goal still shows 0% unless manually updated. This breaks the hierarchical cascade that is the entire point of the Year → Quarter → Month → Week structure.

## User Story

As a user, I want my parent goal's progress to automatically reflect how many of its children are completed so that I can see my real progress through the goal hierarchy without manually updating each level.

## Success Criteria

- [ ] When a child goal's status changes to COMPLETED, the parent goal's `progress` field is recalculated as `(completedChildren / totalChildren) * 100`, rounded to the nearest integer
- [ ] When a child goal's status changes FROM COMPLETED to any other status (reopen), the parent's progress is recalculated downward
- [ ] Recalculation propagates upward through the full hierarchy (completing a Monthly goal recalcs the Quarterly parent, which recalcs the Yearly grandparent)
- [ ] Goals with a `targetValue` set are NOT overwritten by the auto-calc (targetValue-based progress is user-controlled via ProgressIncrement)
- [ ] The recalculation runs inside the existing `completeWithSideEffects` transaction so it is atomic with XP and streak updates

## Affected Layers

- **Prisma schema**: none (progress field already exists as `Int @default(0)`)
- **Service layer**: `lib/services/goal-service.ts` (add `recalcParentProgress` helper, call it from `completeWithSideEffects`), `lib/services/hierarchy-helpers.ts` (add the helper here since it's hierarchy logic)
- **API routes**: none (status change goes through existing `PUT /api/goals/:id` or the completion route)
- **React Query hooks**: none (cache invalidation for `goals.all()` already happens after goal updates)
- **UI components**: none (the progress bar in `goal-detail.tsx` already reads `goal.progress`, so it will reflect the new value automatically)
- **MCP tools**: none (the `complete_goals` MCP tool calls `completeWithSideEffects`, so it gets the recalc for free)
- **Zustand store**: none

## Data Model Changes

None. The `Goal.progress` field (`Int @default(0)`) already exists and stores 0 to 100.

## API Contract

No new routes. The recalculation is a side-effect inside the service layer, transparent to the API.

## Recalculation Logic

```
recalcParentProgress(userId, goalId, tx):
  1. Load the goal to get parentId
  2. If no parentId, return (top-level goal, nothing to propagate)
  3. Load the parent with its children
  4. If parent has targetValue set, return (user-controlled progress, do not overwrite)
  5. Count children where status === "COMPLETED"
  6. Calculate: Math.round((completedCount / totalChildren) * 100)
  7. Update parent.progress = calculated value
  8. Recurse: recalcParentProgress(userId, parent.id, tx) to propagate upward
```

## Cache Invalidation

The existing `completeWithSideEffects` transaction is followed by the API route returning the result, which triggers the client-side `useUpdateGoal` or `useCompleteGoal` mutation's `onSuccess` handler. That handler already invalidates `queryKeys.goals.all()`, which covers both the completed child and its parent.

## Danger Zones Touched

**No transaction wrapping in todo completion** (CLAUDE.md). This feature does NOT touch todo completion. It only modifies the goal completion flow, which already uses `prisma.$transaction` inside `completeWithSideEffects`. The recalc runs inside this same transaction, so it is atomic.

**Hierarchy helpers** (`lib/services/hierarchy-helpers.ts`). Adding a new function here. The existing `validateHierarchy` is the only current function. The new `recalcParentProgress` will also traverse the hierarchy but for progress, not validation.

## Out of Scope

- Weighted progress (e.g., high-priority children count more). Equal weighting only.
- Progress from linked todos (todo completion contributing to goal progress). That's a separate feature.
- UI changes to show "auto-calculated" vs "manual" progress differently.

## Open Questions

None. The hierarchy, transaction, and progress field are all ready.
