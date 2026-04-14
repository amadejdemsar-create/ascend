# Implementation Tasks: Analytics Trend Charts

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 0: Dependency

- [ ] Install recharts: `npm install recharts`. Verify it appears in `package.json` dependencies.

## Phase 1: Service layer

- [ ] Create `lib/services/analytics-service.ts` with an `analyticsService` const object. Follow the pattern from `lib/services/dashboard-service.ts` (parallel queries via `Promise.all`). Add method `getTrends(userId: string, weeks: number = 12)`:
  1. Compute the date range: `startDate = startOfWeek(subWeeks(new Date(), weeks), { weekStartsOn: 1 })`, `endDate = endOfDay(new Date())`.
  2. Run three parallel Prisma queries:
     - **Todo completions**: `prisma.todo.findMany({ where: { userId, status: "DONE", completedAt: { gte: startDate, lte: endDate } }, select: { completedAt: true } })`
     - **XP events**: `prisma.xpEvent.findMany({ where: { userId, createdAt: { gte: startDate, lte: endDate } }, select: { amount: true, createdAt: true } })`
     - **Progress logs**: `prisma.progressLog.findMany({ where: { goal: { userId }, createdAt: { gte: startDate, lte: endDate } }, select: { goalId: true, createdAt: true } })`
  3. Group each result set by ISO week number (use `getISOWeek` and `getISOWeekYear` from `date-fns`). For each week bucket, compute:
     - `todoCompletions[week].count` = count of todos completed
     - `xpEarned[week].amount` = sum of XP event amounts
     - `goalProgress[week].goalsProgressed` = count of unique goalIds with progress logs
  4. Build the week array from oldest to newest, labeling each as `"W{isoWeek}"` with `weekStart` as the Monday date formatted `"yyyy-MM-dd"`.
  5. Compute `summary` by comparing the last two week entries.
  6. Return the `AnalyticsTrendsData` interface (define and export it).
  - Import `subWeeks, startOfWeek, endOfDay, getISOWeek, getISOWeekYear, format, addWeeks` from `date-fns`.

## Phase 2: Validation

- [ ] Add to `lib/validations.ts`: `analyticsQuerySchema = z.object({ weeks: z.coerce.number().min(4).max(52).default(12) })` with exported type `AnalyticsQuery`.

## Phase 3: API route

- [ ] Create `app/api/analytics/route.ts` with `GET` handler. Follow the auth-parse-service-respond pattern from `app/api/review/route.ts` as template. Parse `searchParams` with `analyticsQuerySchema`, call `analyticsService.getTrends(auth.userId, query.weeks)`, return JSON.

## Phase 4: React Query hook

- [ ] Add to `lib/queries/keys.ts`: `analytics: (weeks?: number) => ["analytics", weeks] as const`.

- [ ] Create `lib/hooks/use-analytics.ts` with `useAnalytics(weeks: number = 12)`. `useQuery` calling `GET /api/analytics?weeks={weeks}`. Set `staleTime: 5 * 60 * 1000` (5 minutes) since trend data is not real-time critical. Use the `apiFetch` helper from `lib/api-client.ts` or copy the `fetchJson` pattern from `lib/hooks/use-todos.ts`.

## Phase 5: UI components

- [ ] Create `app/(app)/analytics/page.tsx` as a "use client" page. Calls `useAnalytics()`, renders `AnalyticsPage` component. Simple wrapper similar to `app/(app)/review/page.tsx`.

- [ ] Create `components/analytics/analytics-page.tsx`. Receives data and loading state. Renders:
  1. **Header**: "Analytics" h1 with `font-serif text-2xl font-bold`, subtitle "Last 12 weeks"
  2. **Summary row**: 3 `Card` components in a `grid grid-cols-3 gap-3`. Each shows:
     - The current-week value (large number)
     - A delta indicator: green up-arrow if higher than prev week, red down-arrow if lower, gray dash if equal
     - Label: "Todos completed", "XP earned", "Goals progressed"
  3. **Charts section**: 3 `Card` components, each containing a recharts chart:
     - `TodoCompletionChart`: `BarChart` with `Bar` fill blue/primary
     - `XpEarnedChart`: `AreaChart` with purple gradient fill
     - `GoalProgressChart`: `LineChart` with green line and dots
  4. Each chart card: `CardHeader` with title, `CardContent` with `ResponsiveContainer` from recharts wrapping the chart. Height 220px. X-axis shows week labels, Y-axis auto-scaled.
  5. **Loading state**: 3 summary card skeletons + 3 chart card skeletons (each `Skeleton className="h-[220px] w-full"`)
  6. **Empty state**: "Not enough data yet. Complete some todos and goals to see trends." when all arrays are empty.

- [ ] Create `components/analytics/todo-completion-chart.tsx`: Receives `data: Array<{ week: string; count: number }>`. Renders a recharts `BarChart` with `XAxis dataKey="week"`, `YAxis`, `Tooltip`, `Bar dataKey="count"` with `fill` using CSS variable `hsl(var(--primary))` or a hex blue.

- [ ] Create `components/analytics/xp-earned-chart.tsx`: Receives `data: Array<{ week: string; amount: number }>`. Renders a recharts `AreaChart` with gradient fill (purple). Uses `defs` > `linearGradient` for the area fill.

- [ ] Create `components/analytics/goal-progress-chart.tsx`: Receives `data: Array<{ week: string; goalsProgressed: number }>`. Renders a recharts `LineChart` with green stroke and dot markers.

## Phase 6: Navigation

- [ ] Add "Analytics" nav item to `components/layout/nav-config.ts` (after Review, before Context). Icon: `TrendingUp` from lucide-react. Href: `/analytics`.

## Phase 7: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Run `/ax:review` to audit the new service, route, and hooks against safety rules.
