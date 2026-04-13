# Implementation Tasks: Goal Progress Auto-Calculation

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Service layer (recalculation helper)

- [ ] Add `recalcParentProgress(userId: string, goalId: string, tx: PrismaTransactionClient)` to `lib/services/hierarchy-helpers.ts`. The function:
  1. Loads the goal by `id` + `userId` to get `parentId` (using `tx` client)
  2. If no `parentId`, returns early (top-level goal)
  3. Loads the parent goal with `include: { children: { select: { id: true, status: true } } }` (using `tx` client, scoped by `userId`)
  4. If parent has `targetValue !== null`, returns early (user-controlled progress via ProgressIncrement)
  5. Counts children where `status === "COMPLETED"`
  6. Calculates `Math.round((completedCount / totalChildren) * 100)`
  7. Updates `parent.progress` via `tx.goal.update({ where: { id: parent.id }, data: { progress } })`
  8. Recurses: calls `recalcParentProgress(userId, parent.id, tx)` to propagate up the chain
  - Import the `PrismaClientLike` type pattern already used in `goal-service.ts` (or use `Parameters<typeof prisma.$transaction>[0]` callback argument type). Check how `completeWithSideEffects` types its `tx` parameter and match that.

## Phase 2: Wire into goal completion

- [ ] Edit `lib/services/goal-service.ts` `completeWithSideEffects` method (line ~132). After step 3 (streak bump, line ~166), add step 4: call `recalcParentProgress(userId, id, tx)` to propagate progress up the hierarchy. Import `recalcParentProgress` from `./hierarchy-helpers`.

- [ ] Also wire into the `update` method for status changes that go through the regular update path (not just `completeWithSideEffects`). When `data.status` is being changed on a goal that has a `parentId`, call `recalcParentProgress` after the update. This handles both completion AND reopening (status changed from COMPLETED back to IN_PROGRESS). Since `update` already accepts a `client` parameter (`PrismaClientLike`), pass it through. Note: when called from `completeWithSideEffects`, the tx is already threaded through. When called from the regular API route, it runs without a transaction (existing behavior, acceptable risk since progress recalc is not critical-path).

## Phase 3: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Run `/ax:review` to audit `hierarchy-helpers.ts` and `goal-service.ts` against safety rules (userId in every query, no direct Prisma imports in routes).
