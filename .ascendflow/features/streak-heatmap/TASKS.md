# Implementation Tasks: Streak / Consistency Heatmap

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Service layer

- [ ] Add `getCompletionHistory(userId: string, templateId: string, days: number)` to `lib/services/todo-recurring-service.ts` (after the existing `getStreakData` method at line ~427). The method:
  1. Verify the template exists and belongs to the user: `prisma.todo.findFirst({ where: { id: templateId, userId, isRecurring: true, recurringSourceId: null } })`. Throw if not found.
  2. Compute date range: `startDate = subDays(new Date(), days)`, `endDate = new Date()`.
  3. Fetch all instances of this template in the range: `prisma.todo.findMany({ where: { userId, recurringSourceId: templateId, dueDate: { gte: startDate, lte: endDate } }, select: { dueDate: true, completedAt: true, status: true }, orderBy: { dueDate: "asc" } })`.
  4. Also fetch template streak data: `currentStreak`, `longestStreak`, `consistencyScore` from the template row.
  5. Build a day-by-day array for each date in the range: for each day, check if an instance exists (by matching `dueDate`). If yes and `completedAt` is set → `"completed"`. If yes and `completedAt` is null and `dueDate < today` → `"missed"`. If yes and `dueDate >= today` → `"pending"`. If no instance → `"none"`.
  6. Return `{ templateId, currentStreak, longestStreak, consistencyScore, days: Array<{ date: string, status: "completed" | "missed" | "pending" | "none" }> }`.
  - Import `subDays, startOfDay, format, isBefore` from `date-fns`.

## Phase 2: Validation

- [ ] Add to `lib/validations.ts`: `streakHistoryQuerySchema = z.object({ days: z.coerce.number().min(7).max(365).default(90) })` with exported type `StreakHistoryQuery`.

## Phase 3: API route

- [ ] Create `app/api/todos/[id]/streak-history/route.ts` with `GET` handler. Follow the pattern from `app/api/todos/[id]/route.ts` as template. Extract `id` from params, parse query params with `streakHistoryQuerySchema`, call `todoRecurringService.getCompletionHistory(auth.userId, id, query.days)`, return JSON.

## Phase 4: React Query hook

- [ ] Add to `lib/queries/keys.ts` in the `todos` group: `streakHistory: (id: string) => ["todos", "streak-history", id] as const`.

- [ ] Add `useStreakHistory(todoId: string)` to `lib/hooks/use-todos.ts`. `useQuery` calling `GET /api/todos/${todoId}/streak-history`, enabled when `todoId` is truthy. Use the existing `fetchJson` helper in the file.

## Phase 5: UI component

- [ ] Create `components/todos/streak-heatmap.tsx`. Props: `todoId: string`. Internally calls `useStreakHistory(todoId)`. Renders:
  1. **Header row**: "Current streak: {N}" with Flame icon, "Best: {N}", "Consistency: {N}%" 
  2. **Heatmap grid**: CSS grid with 7 rows (Mon through Sun) and dynamic columns (one per week in the data). Each cell is a `<div>` sized `size-3` with `rounded-sm`. Colors:
     - `bg-muted` for `"none"`
     - `bg-green-500` for `"completed"` (with opacity levels: `bg-green-500/40` for older, `bg-green-500` for recent, to create a gradient feel, or just solid green)
     - `bg-red-400/50` for `"missed"`
     - `bg-muted-foreground/20` for `"pending"` (future)
  3. **Row labels**: single-letter day abbreviations (M, T, W, T, F, S, S) on the left
  4. **Tooltip**: use the `title` attribute on each cell with the date (European format) and status
  5. **Loading state**: skeleton grid matching the heatmap shape
  6. **Empty state**: "No streak data yet" if the days array is empty
  - Use `startOfWeek`, `addDays`, `format`, `getDay` from `date-fns` to organize days into a week grid. Week starts Monday (`weekStartsOn: 1`).

- [ ] Wire into `components/todos/todo-detail.tsx`: import `StreakHeatmap`. After the recurring info section (the block that shows streak count and consistency score, around line 431-447), add `<StreakHeatmap todoId={todo.recurringSourceId ?? todoId} />`. Only render when `todo.isRecurring` is true. Use `recurringSourceId` if the user is viewing an instance (to fetch the template's history), or `todoId` if viewing the template itself.

## Phase 6: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Run `/ax:review` to audit the new service method, route, and hook against safety rules.
