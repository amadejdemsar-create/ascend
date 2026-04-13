# Implementation Tasks: Weekly Review

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Service layer (aggregation)

- [ ] Create `lib/services/review-service.ts` with a `reviewService` const object following the pattern in `lib/services/dashboard-service.ts`. Add method `getWeeklyReview(userId: string, weekStart: string)` that:
  1. Parses `weekStart` to a Date, computes `weekEnd` as `addDays(weekStart, 6)` with end of day
  2. Runs parallel Prisma queries (same `Promise.all` pattern as `dashboardService.getDashboardData`):
     - Todos completed this week: `prisma.todo.findMany({ where: { userId, status: "DONE", completedAt: { gte: weekStartDate, lte: weekEndDate } }, include: { goal: { select: { id: true, title: true } } } })`
     - Todos carried over (pending, due this week or earlier): `prisma.todo.findMany({ where: { userId, status: "PENDING", dueDate: { lte: weekEndDate } }, include: { goal: { select: { id: true, title: true } } } })`
     - Goals completed this week: `prisma.goal.findMany({ where: { userId, status: "COMPLETED", completedAt: { gte: weekStartDate, lte: weekEndDate } }, select: { id, title, horizon, completedAt } })`
     - XP events this week: `prisma.xpEvent.findMany({ where: { userId, createdAt: { gte: weekStartDate, lte: weekEndDate } } })` then sum `amount`
     - Big 3 data: `prisma.todo.findMany({ where: { userId, isBig3: true, dueDate: { gte: weekStartDate, lte: weekEndDate } } })` then count unique dates for `big3Days`, total for `big3Total`
     - Goal progress deltas: `prisma.progressLog.findMany({ where: { goal: { userId }, createdAt: { gte: weekStartDate, lte: weekEndDate } }, include: { goal: { select: { id, title, progress } } } })` then group by goalId, compute first/last values as delta
  3. Returns the aggregated `WeeklyReviewData` shape (define the interface in the same file, export it)

- [ ] Add method `saveReview(userId: string, data: { weekStart: string, wentWell: string, toImprove: string, stats: object })` that calls `contextService.create(userId, { title: "Weekly Review: {weekStart} to {weekEnd}", content: markdownBody, tags: ["weekly-review"] })` where `markdownBody` formats the reflection + stats as a readable markdown document. Import `contextService` from `./context-service`.

## Phase 2: Validation schemas

- [ ] Add to `lib/validations.ts`:
  - `weeklyReviewQuerySchema = z.object({ weekStart: z.string() })` with exported type `WeeklyReviewQuery`
  - `saveReviewSchema = z.object({ weekStart: z.string(), wentWell: z.string(), toImprove: z.string(), stats: z.record(z.unknown()).optional() })` with exported type `SaveReviewInput`

## Phase 3: API routes

- [ ] Create `app/api/review/route.ts` with `GET` handler. Follow the auth-parse-service-respond pattern from `app/api/dashboard/route.ts` as template. Parse `searchParams` with `weeklyReviewQuerySchema`, call `reviewService.getWeeklyReview(auth.userId, query.weekStart)`, return JSON.

- [ ] Create `app/api/review/save/route.ts` with `POST` handler. Parse body with `saveReviewSchema`, call `reviewService.saveReview(auth.userId, data)`, return 201.

## Phase 4: React Query hooks

- [ ] Add to `lib/queries/keys.ts`: `review: { weekly: (weekStart: string) => ["review", "weekly", weekStart] as const }`

- [ ] Create `lib/hooks/use-review.ts` with:
  - `useWeeklyReview(weekStart: string)` — `useQuery` calling `GET /api/review?weekStart={weekStart}`, enabled when `weekStart` is truthy
  - `useSaveReview()` — `useMutation` calling `POST /api/review/save`, `onSuccess` invalidates `queryKeys.context.all()` and `queryKeys.review.weekly(weekStart)`
  - Use the `fetchJson` helper pattern from `lib/hooks/use-todos.ts` (copy the inline helper or use `apiFetch` from `lib/api-client.ts`)

## Phase 5: UI components

- [ ] Create `app/(app)/review/page.tsx` as a "use client" page. Contains the week selector state (`useState<Date>` defaulting to Monday of current week), calls `useWeeklyReview(format(weekStart, "yyyy-MM-dd"))`, renders the `WeeklyReviewPage` component.

- [ ] Create `components/review/weekly-review-page.tsx`. Receives the review data as props. Renders:
  1. **Week selector**: prev/next arrows (ChevronLeft/ChevronRight icons), formatted week range ("7. 4. 2026 to 13. 4. 2026"), "This Week" button
  2. **Stats grid**: 6 cards in a `grid grid-cols-2 md:grid-cols-3 gap-3` layout. Each card shows a number + label. Use `Card` from `components/ui/card.tsx`.
  3. **Completed section**: collapsible (use `Collapsible` from `components/ui/collapsible.tsx`) list of completed todos with checkmark icon, title, and linked goal name
  4. **Carried over section**: collapsible list of pending todos with priority badge and due date
  5. **Goal progress section**: list of goals with progress delta, showing a mini before/after progress bar
  6. **Reflection section**: two `Textarea` components ("What went well?" and "What to improve?") from `components/ui/textarea.tsx`
  7. **Save button**: `Button` that calls `useSaveReview()`, shows toast on success

- [ ] Loading state: full-page skeleton matching the layout (stats grid skeleton + list skeletons)
- [ ] Empty state for weeks with no data: "No activity recorded for this week."

## Phase 6: Navigation

- [ ] Add "Review" nav item to `components/layout/nav-config.ts` (between Calendar and Context). Icon: `ClipboardCheck` from lucide-react. Href: `/review`.

## Phase 7: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Run `/ax:review` to audit new service, routes, and hooks against safety rules.
- [ ] Run `/ax:verify-ui` on `/review` page.
