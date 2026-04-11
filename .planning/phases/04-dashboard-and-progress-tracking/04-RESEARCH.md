# Phase 4: Dashboard and Progress Tracking - Research

**Researched:** 2026-03-30
**Domain:** Dashboard widget composition, progress tracking UI, real-time query invalidation, date-based filtering
**Confidence:** HIGH

## Summary

Phase 4 transforms the placeholder dashboard page into the app's primary landing experience and adds the progress tracking UI that connects daily actions to measurable outcomes. The phase covers two distinct but interconnected areas: (1) four dashboard widgets (This Week's Focus, Progress Overview, Upcoming Deadlines, Streaks & Stats) that aggregate goal data into actionable summaries, and (2) a progress tracking system where users can increment measurable goals, add notes to progress entries, and view their full progress history.

The existing codebase provides a strong foundation. The `goalService.logProgress()` method and `goalService.getProgressHistory()` already exist in the service layer, and the API routes at `/api/goals/[id]/progress` (POST and GET) are fully wired. The `ProgressLog` model in Prisma stores timestamped entries with values and optional notes. The `Goal` model already has `targetValue`, `currentValue`, `unit`, and `progress` (percentage) fields, and the service layer auto-calculates progress percentage when logging. The `GoalDetail` component already renders a progress bar for goals with `targetValue`. What is missing is the progress increment UI (the +1 button), the progress history view, the dashboard widgets, and the dedicated dashboard API endpoints that aggregate data for the widgets.

The primary technical challenge is the dashboard API layer. The four widgets each need aggregated data that does not map 1:1 to existing API endpoints. Rather than making multiple API calls from the client and computing aggregations in the browser, the research recommends adding a dedicated `/api/dashboard` endpoint that returns all widget data in a single response. This keeps the client simple (one React Query hook for the entire dashboard) and moves the aggregation logic to the service layer where it has direct Prisma access. Real-time updates (DASH-06) are achieved through React Query's existing invalidation pattern: when any goal mutation succeeds, dashboard queries are also invalidated and refetched.

**Primary recommendation:** Add a `dashboardService` module with a single `getDashboardData()` method that returns all four widgets' data in one call. Expose it via `GET /api/dashboard`. On the frontend, build four self-contained widget components that receive their data as props from the dashboard page, which uses a single `useDashboard()` React Query hook. For progress tracking, add `useLogProgress` and `useProgressHistory` hooks that follow the existing mutation/query patterns, and build a `ProgressIncrementButton` component and `ProgressHistorySheet` component for the goal detail panel.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Dashboard is the default landing page | The `app/(app)/page.tsx` already maps to `/` and is the default route. The nav config shows Dashboard as the first nav item pointing to `/`. Replace the placeholder content with the widget layout. |
| DASH-02 | "This Week's Focus" widget with top priority weekly goals | New `dashboardService.getDashboardData()` queries goals where `horizon = WEEKLY`, `status IN (NOT_STARTED, IN_PROGRESS)`, ordered by priority DESC then deadline ASC. Uses `date-fns` `startOfWeek`/`endOfWeek` for the current week window if deadline filtering is desired, but primarily filters by horizon and active status since weekly goals inherently represent the current focus. |
| DASH-03 | "Progress Overview" widget with completion % per category as visual bars | Aggregation query groups goals by `categoryId`, counts completed vs total per category, returns percentage with category name/color. Uses Prisma `groupBy` or a raw query for efficient aggregation. Visual bars rendered with Tailwind width classes. |
| DASH-04 | "Streaks & Stats" widget with active streaks, goals completed this month, completion rate, current XP/level | `UserStats` model already exists in schema with `totalXp`, `level`, `currentStreak`, `longestStreak`, `weeklyScore`, `goalsCompleted`. For v1 (pre-gamification Phase 9), populate basic stats (goals completed this month, completion rate) from goal queries. XP/level display uses placeholder values from UserStats or sensible defaults until Phase 9 populates them. |
| DASH-05 | "Upcoming Deadlines" widget with goals due in next 7 and 14 days | Query goals where `deadline` is between now and now+14 days using Prisma `gte`/`lte` date filters. `date-fns` `addDays` computes the window boundaries. Group results into "next 7 days" and "7 to 14 days" sections. |
| DASH-06 | Dashboard widgets update in real time when goals are modified | Extend all existing goal/category mutation hooks (`useUpdateGoal`, `useCreateGoal`, `useDeleteGoal`, etc.) to also invalidate the dashboard query key. The dashboard uses a React Query hook with its own query key (`["dashboard"]`), which gets invalidated alongside goal queries on any mutation. No polling or WebSocket needed; mutation-driven invalidation is sufficient. |
| PROG-01 | Quick +1 button (or custom amount) on measurable goals | Add `ProgressIncrementButton` component to the goal detail panel. Default increment is +1; clicking opens a small popover for custom amount. Calls `POST /api/goals/[id]/progress` via `useLogProgress` mutation hook. Existing `goalService.logProgress()` handles currentValue update and progress recalculation. |
| PROG-02 | Progress entry with optional note | The existing `addProgressSchema` validates `{ value: number, note?: string }`. The progress increment popover includes an optional text input for the note. The `ProgressLog` model stores the note alongside the value and timestamp. |
| PROG-03 | View progress history with timestamps and notes | Add `ProgressHistorySheet` component (using shadcn Sheet for slide-over panel) that displays all `ProgressLog` entries for a goal. Uses `useProgressHistory` hook calling `GET /api/goals/[id]/progress`. Entries shown as a reverse-chronological list with `date-fns` `formatDistanceToNow` for relative timestamps. |
| PROG-04 | Progress percentage auto-calculated from current vs target | Already implemented in `goalService.logProgress()`: `Math.min(100, Math.round((newCurrentValue / targetValue) * 100))`. The `GoalDetail` component already renders the progress bar. No additional work needed for the calculation itself; the dashboard Progress Overview widget reuses this field. |
| PROG-05 | Parent goal progress aggregates from children's completion status | Add a `computeChildrenProgress()` helper in the service layer that counts completed children vs total children and returns a percentage. Call this when fetching dashboard data or goal detail. The existing `goalService.update()` does not auto-update parent progress, so this is a read-time computation (not write-time), keeping the data model simple. The rollup suggestion toast (from Phase 2, GOAL-12) already handles the "suggest completing parent" flow. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.95.2 (installed) | Dashboard data fetching, progress mutation hooks | Already used for all data fetching. Dashboard hook follows identical pattern to `useGoals`. Invalidation chain handles DASH-06 real-time updates. |
| `date-fns` | ^4.1.0 (installed) | Date window calculations for deadline widget, relative timestamps for progress history | Already installed. v4 has first-class time zone support. Functions needed: `addDays`, `startOfWeek`, `endOfWeek`, `isAfter`, `isBefore`, `formatDistanceToNow`, `format`, `startOfMonth`, `endOfMonth`. |
| `zustand` | 5.0.12 (installed) | No new store changes needed | Dashboard state is server-driven (React Query), not client state. No store extensions required. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^1.7.0 (installed) | Widget icons, progress action icons | For widget header icons (TrendingUp, Target, Calendar, Flame, Plus, Minus, History) |
| `sonner` | ^2.0.7 (installed) | Toast feedback on progress actions | Success/error feedback when logging progress |
| shadcn/ui `Sheet` | (installed) | Progress history slide-over panel | Renders progress log entries in a side sheet, triggered from goal detail |
| shadcn/ui `Card` | needs install | Dashboard widget containers | Standard card component for consistent widget styling. Currently not installed. |
| shadcn/ui `Progress` | needs install | Visual progress bars in widgets | Accessible progress bar component with proper ARIA attributes. Alternative: continue using the inline Tailwind div-based bar from GoalDetail. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single `/api/dashboard` endpoint | Multiple client-side queries + aggregation | Multiple queries add waterfall latency and duplicate logic. Single endpoint is simpler, faster, and avoids N+1 client queries. The MCP server (Phase 5) also benefits from a single dashboard service method. |
| Read-time children progress aggregation | Write-time parent progress updates | Write-time updates add complexity to every goal status change (must find parent, recompute, update). Read-time is simpler and correct for the expected data volume (hundreds, not thousands of goals). |
| shadcn `Card` for widgets | Raw `div` with Tailwind classes | Card component provides consistent border, padding, header/content/footer slots. Installing it is one `npx shadcn@latest add card` command and avoids reinventing the same div pattern four times. |
| shadcn `Progress` for bars | Inline Tailwind `div` bar (already used in GoalDetail) | The GoalDetail already uses an inline div bar. For consistency, either pattern works. The inline div pattern is already established in the codebase, so continuing with it avoids adding a new component for the same purpose. Use inline div bars for consistency with GoalDetail. |

**Installation:**
```bash
cd /Users/Shared/Domain/Code/Personal/ascend && npx shadcn@latest add card
```

No other new packages needed. All core libraries are already installed.

## Architecture Patterns

### Recommended File Structure (new files for Phase 4)
```
app/
├── (app)/
│   └── page.tsx                    # Replace placeholder with DashboardPage
├── api/
│   └── dashboard/
│       └── route.ts                # GET /api/dashboard (single aggregation endpoint)

components/
├── dashboard/
│   ├── dashboard-page.tsx          # Client component composing all widgets
│   ├── weekly-focus-widget.tsx     # DASH-02: This week's priority goals
│   ├── progress-overview-widget.tsx # DASH-03: Completion % per category
│   ├── streaks-stats-widget.tsx    # DASH-04: Stats summary
│   └── upcoming-deadlines-widget.tsx # DASH-05: Goals due soon
├── goals/
│   ├── progress-increment.tsx      # PROG-01/02: +1 button with popover for custom amount + note
│   └── progress-history-sheet.tsx  # PROG-03: Sheet showing all progress entries

lib/
├── hooks/
│   └── use-dashboard.ts            # useDashboard() hook + useLogProgress + useProgressHistory
├── queries/
│   └── keys.ts                     # Add dashboard query key
└── services/
    └── dashboard-service.ts        # getDashboardData() aggregation logic
```

### Pattern 1: Single Dashboard Aggregation Endpoint

**What:** A single service method that runs multiple Prisma queries in parallel and returns a unified dashboard response object. Exposed via one API route.

**When to use:** When the dashboard needs data from multiple sources (goals filtered by horizon, deadline, category, user stats) and sending N separate API requests would be wasteful.

**Example:**
```typescript
// lib/services/dashboard-service.ts
import { prisma } from "@/lib/db";
import { startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth } from "date-fns";

export interface DashboardData {
  weeklyFocus: WeeklyFocusGoal[];
  progressOverview: CategoryProgress[];
  streaksStats: StatsData;
  upcomingDeadlines: DeadlineGoal[];
}

export const dashboardService = {
  async getDashboardData(userId: string): Promise<DashboardData> {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const in7Days = addDays(now, 7);
    const in14Days = addDays(now, 14);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Run queries in parallel
    const [weeklyGoals, deadlineGoals, allGoals, completedThisMonth] =
      await Promise.all([
        // Weekly focus: active weekly goals, ordered by priority
        prisma.goal.findMany({
          where: {
            userId,
            horizon: "WEEKLY",
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
          },
          orderBy: [
            { priority: "desc" },
            { deadline: "asc" },
          ],
          take: 5,
          include: { category: true },
        }),
        // Upcoming deadlines: goals with deadline in next 14 days
        prisma.goal.findMany({
          where: {
            userId,
            deadline: { gte: now, lte: in14Days },
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
          },
          orderBy: { deadline: "asc" },
          include: { category: true },
        }),
        // All goals for progress overview (category aggregation)
        prisma.goal.findMany({
          where: { userId, categoryId: { not: null } },
          select: {
            id: true,
            status: true,
            categoryId: true,
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
        }),
        // Goals completed this month
        prisma.goal.count({
          where: {
            userId,
            status: "COMPLETED",
            completedAt: { gte: monthStart, lte: monthEnd },
          },
        }),
      ]);

    // Compute progress overview by category
    const categoryMap = new Map<string, { name: string; color: string; icon: string | null; total: number; completed: number }>();
    for (const goal of allGoals) {
      if (!goal.categoryId || !goal.category) continue;
      const existing = categoryMap.get(goal.categoryId);
      if (existing) {
        existing.total++;
        if (goal.status === "COMPLETED") existing.completed++;
      } else {
        categoryMap.set(goal.categoryId, {
          name: goal.category.name,
          color: goal.category.color,
          icon: goal.category.icon,
          total: 1,
          completed: goal.status === "COMPLETED" ? 1 : 0,
        });
      }
    }

    const progressOverview = Array.from(categoryMap.values()).map((cat) => ({
      ...cat,
      percentage: cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0,
    }));

    // Compute total goals and completion rate
    const totalGoals = await prisma.goal.count({ where: { userId } });
    const totalCompleted = await prisma.goal.count({
      where: { userId, status: "COMPLETED" },
    });

    return {
      weeklyFocus: weeklyGoals,
      progressOverview,
      streaksStats: {
        completedThisMonth,
        totalGoals,
        totalCompleted,
        completionRate: totalGoals > 0 ? Math.round((totalCompleted / totalGoals) * 100) : 0,
        // XP/level/streaks are placeholder until Phase 9 gamification
        currentXp: 0,
        level: 1,
        currentStreak: 0,
      },
      upcomingDeadlines: deadlineGoals,
    };
  },
};
```

### Pattern 2: Dashboard React Query Hook with Cross-Invalidation

**What:** A single `useDashboard()` hook that fetches all dashboard data, with cross-invalidation from goal/category mutations.

**When to use:** The dashboard page component calls this hook. All mutation hooks invalidate the dashboard key alongside their existing invalidation targets.

**Example:**
```typescript
// lib/hooks/use-dashboard.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import type { AddProgressInput } from "@/lib/validations";

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => fetchJson<DashboardData>("/api/dashboard"),
  });
}

export function useLogProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: AddProgressInput }) =>
      fetchJson(`/api/goals/${goalId}/progress`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(goalId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useProgressHistory(goalId: string) {
  return useQuery({
    queryKey: queryKeys.goals.progress(goalId),
    queryFn: () => fetchJson<ProgressLogEntry[]>(`/api/goals/${goalId}/progress`),
    enabled: !!goalId,
  });
}
```

### Pattern 3: Widget Component Structure

**What:** Each widget is a self-contained component that receives pre-fetched data as props. The parent dashboard page fetches data once and distributes it.

**When to use:** Dashboard composition pattern for all four widgets.

**Example:**
```typescript
// components/dashboard/weekly-focus-widget.tsx
interface WeeklyFocusWidgetProps {
  goals: WeeklyFocusGoal[];
}

export function WeeklyFocusWidget({ goals }: WeeklyFocusWidgetProps) {
  if (goals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">This Week's Focus</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No weekly goals set. Create one to stay focused.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TargetIcon className="size-4" />
          This Week's Focus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {goals.map((goal) => (
          <WeeklyGoalRow key={goal.id} goal={goal} />
        ))}
      </CardContent>
    </Card>
  );
}
```

### Pattern 4: Progress Increment with Popover

**What:** A compact +1 button that logs a single increment. Clicking an expand control reveals a popover for custom amount and optional note.

**When to use:** On the goal detail panel for any goal that has a `targetValue` set.

**Example:**
```typescript
// components/goals/progress-increment.tsx
export function ProgressIncrement({ goalId, unit }: { goalId: string; unit?: string | null }) {
  const logProgress = useLogProgress();
  const [showCustom, setShowCustom] = useState(false);
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");

  async function handleQuickIncrement() {
    await logProgress.mutateAsync({ goalId, data: { value: 1 } });
    toast.success(`+1${unit ? ` ${unit}` : ""} logged`);
  }

  async function handleCustomSubmit() {
    const value = Number(amount);
    if (value <= 0) return;
    await logProgress.mutateAsync({
      goalId,
      data: { value, note: note.trim() || undefined },
    });
    toast.success(`+${value}${unit ? ` ${unit}` : ""} logged`);
    setShowCustom(false);
    setAmount("1");
    setNote("");
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleQuickIncrement} disabled={logProgress.isPending}>
        <PlusIcon className="size-3.5" />
        +1{unit ? ` ${unit}` : ""}
      </Button>
      {/* Popover for custom amount + note */}
    </div>
  );
}
```

### Pattern 5: Children Progress Aggregation (Read-Time)

**What:** When displaying a parent goal, compute its aggregate progress from children's completion status. This is a read-time computation, not stored in the database.

**When to use:** Dashboard Progress Overview (PROG-05) and goal detail panel.

**Example:**
```typescript
// lib/services/goal-service.ts (add method)
async getChildrenProgress(userId: string, goalId: string): Promise<number> {
  const children = await prisma.goal.findMany({
    where: { userId, parentId: goalId },
    select: { status: true },
  });
  if (children.length === 0) return 0;
  const completed = children.filter((c) => c.status === "COMPLETED").length;
  return Math.round((completed / children.length) * 100);
}
```

### Anti-Patterns to Avoid

- **Multiple API calls from dashboard widgets:** Each widget making its own fetch creates a waterfall. The single `/api/dashboard` endpoint returns everything in one round trip.
- **Storing dashboard state in Zustand:** Dashboard data is server-derived, not user preference. React Query handles caching, staleness, and refetching. Zustand is for UI preferences (view, filters, sidebar state).
- **Write-time parent progress updates:** Updating parent progress on every child status change adds write amplification and complex update chains (what if the parent also has a parent?). Read-time aggregation is simpler and always correct.
- **Polling for real-time updates:** Polling with `refetchInterval` is wasteful for a single-user app. Mutation-driven invalidation is the correct pattern: when the user changes a goal, the dashboard refetches. There is no other user who could change data.
- **Adding WebSocket or Server-Sent Events:** Massive infrastructure complexity for zero benefit in a single-user app. React Query invalidation handles all "real-time" needs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date window calculations | Manual `new Date()` arithmetic | `date-fns` `addDays`, `startOfWeek`, `endOfWeek`, `startOfMonth`, `endOfMonth` | Date arithmetic is notoriously error-prone (month boundaries, daylight saving, timezone). `date-fns` is already installed and handles all edge cases. |
| Progress percentage | Custom percentage formula scattered across components | Existing `goalService.logProgress()` formula: `Math.min(100, Math.round((current / target) * 100))` | Already implemented in the service layer. Reuse the field `progress` on the Goal model rather than recalculating in the UI. |
| Relative timestamps | Custom "3 hours ago" logic | `date-fns` `formatDistanceToNow` | Handles all intervals (seconds, minutes, hours, days, months, years) with proper pluralization. |
| Dashboard card layout | Custom div styling per widget | shadcn `Card` component (`CardHeader`, `CardTitle`, `CardContent`) | Provides consistent padding, borders, and composable sections. One install command. |

**Key insight:** This phase is primarily about data aggregation and composition, not new technology. The hardest part is designing the dashboard service method to efficiently query and aggregate goal data from multiple dimensions (horizon, deadline, category, status) in a single database round trip. The frontend components are straightforward: cards with lists, bars, and counts.

## Common Pitfalls

### Pitfall 1: N+1 Queries in Dashboard Aggregation
**What goes wrong:** The dashboard service method runs a separate Prisma query per category to compute progress, or per parent goal to compute children aggregation, resulting in dozens of queries.
**Why it happens:** Natural inclination to iterate over categories/parents and query each one individually.
**How to avoid:** Fetch all goals for the user in one query with `select` (only the fields needed: id, status, categoryId, category). Aggregate in JavaScript using a Map. This is efficient because a single user will have at most hundreds of goals, easily processable in memory.
**Warning signs:** Dashboard load time increases linearly with the number of categories or parent goals.

### Pitfall 2: Stale Dashboard After Goal Changes
**What goes wrong:** User marks a goal as complete on the goals page, navigates to the dashboard, and the widget still shows the old data.
**Why it happens:** Goal mutation hooks only invalidate `queryKeys.goals.all()` but not the dashboard query key.
**How to avoid:** Add `queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })` to the `onSuccess` callback of every goal and category mutation hook. This ensures the dashboard refetches whenever any goal data changes. The query key `["dashboard"]` should be a prefix of the dashboard key so that `invalidateQueries` with `queryKeys.goals.all()` (which is `["goals"]`) does NOT accidentally invalidate the dashboard; they are separate key namespaces.
**Warning signs:** Dashboard shows outdated numbers; user must manually refresh the page.

### Pitfall 3: Empty State Widget Overload
**What goes wrong:** A new user with no goals sees four empty widgets, each with its own "no data" message, creating a discouraging wall of emptiness.
**Why it happens:** Each widget independently checks for empty data and renders its own empty state.
**How to avoid:** The dashboard page should detect when the user has zero goals total and render a single welcoming empty state with a call-to-action to create their first goal. Individual widget empty states only appear when the user has some goals but not the specific type (e.g., has yearly goals but no weekly goals).
**Warning signs:** New user bounces from the dashboard because it looks broken or unhelpful.

### Pitfall 4: Progress History Sheet Blocking Goal Detail
**What goes wrong:** Opening the progress history sheet covers the goal detail panel, making it impossible to see the goal's current progress while browsing history.
**Why it happens:** Using a full-screen sheet or dialog for progress history.
**How to avoid:** Use `Sheet` with `side="right"` so it slides over from the right, or render the history as a collapsible section within the goal detail panel itself. On mobile, the sheet approach works better since the goal detail already takes the full screen.
**Warning signs:** User constantly opens/closes the history to compare entries with the current state.

### Pitfall 5: Priority Sort Direction for Weekly Focus
**What goes wrong:** Weekly focus widget shows LOW priority goals first because the default sort is alphabetical (HIGH > LOW > MEDIUM).
**Why it happens:** Prisma sorts enum values alphabetically by default, not by semantic priority.
**How to avoid:** Prisma PostgreSQL enum ordering depends on the order enums were defined. The enum `Priority` is defined as `LOW, MEDIUM, HIGH` in the schema. Prisma `orderBy: { priority: "desc" }` sorts by internal enum ordinal (depends on PostgreSQL enum creation order). Verify the actual sort order in testing. If needed, use a raw SQL `ORDER BY CASE` or sort in JavaScript after fetching. Since the weekly focus is limited to 5 results, post-fetch sorting is trivial.
**Warning signs:** The "focus" widget shows low-priority tasks prominently.

### Pitfall 6: Gamification Fields Not Yet Populated
**What goes wrong:** Streaks & Stats widget tries to display XP, level, and streaks from `UserStats` but the table has no rows yet (Phase 9 creates and populates them).
**Why it happens:** The `UserStats` model exists in the schema but no records are created until Phase 9 gamification.
**How to avoid:** The dashboard service should handle missing UserStats gracefully with fallback defaults (level: 1, xp: 0, streak: 0). The widget should display the stats fields but show them as "0" or "Level 1" rather than erroring. The non-gamification stats (goals completed this month, completion rate) can be computed from goal data directly without UserStats.
**Warning signs:** Widget crashes or shows "undefined" because UserStats is null.

## Code Examples

Verified patterns from official sources and existing codebase:

### Query Keys Extension

```typescript
// lib/queries/keys.ts (extend existing)
export const queryKeys = {
  goals: {
    all: () => ["goals"] as const,
    list: (filters?: GoalFilters) => ["goals", "list", filters] as const,
    detail: (id: string) => ["goals", "detail", id] as const,
    tree: () => ["goals", "tree"] as const,
    progress: (goalId: string) => ["goals", "progress", goalId] as const,
  },
  categories: {
    all: () => ["categories"] as const,
    tree: () => ["categories", "tree"] as const,
  },
  dashboard: () => ["dashboard"] as const,
};
```

### Dashboard API Route

```typescript
// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { dashboardService } from "@/lib/services/dashboard-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const data = await dashboardService.getDashboardData(auth.userId);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Cross-Invalidation in Existing Mutation Hooks

```typescript
// lib/hooks/use-goals.ts (modify onSuccess in existing hooks)
export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGoalInput }) =>
      fetchJson(`/api/goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(id) });
      // Phase 4: also invalidate dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}
```

### Progress History Display

```typescript
// Source: date-fns formatDistanceToNow for relative timestamps
import { formatDistanceToNow, format } from "date-fns";

function ProgressEntry({ entry }: { entry: ProgressLogEntry }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold">
            +{entry.value}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
          </span>
        </div>
        {entry.note && (
          <p className="text-sm text-muted-foreground mt-0.5">{entry.note}</p>
        )}
      </div>
    </div>
  );
}
```

### Dashboard Grid Layout

```typescript
// Responsive grid: 1 column on mobile, 2 on tablet, 2 on desktop
// Weekly Focus and Upcoming Deadlines are taller, so they share a column
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <WeeklyFocusWidget goals={data.weeklyFocus} />
  <ProgressOverviewWidget categories={data.progressOverview} />
  <StreaksStatsWidget stats={data.streaksStats} />
  <UpcomingDeadlinesWidget goals={data.upcomingDeadlines} />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple fetch calls per dashboard widget | Single aggregation endpoint returning all widget data | Standard pattern for dashboard APIs | Eliminates waterfall, reduces client complexity, makes dashboard data available to MCP server in one call |
| Polling with `refetchInterval` for "real-time" | Mutation-driven invalidation via `onSuccess` callbacks | TanStack Query v5 best practice | Zero wasted requests; dashboard only refetches when data actually changes |
| `moment.js` for date calculations | `date-fns` v4 with tree-shaking | date-fns has been standard since ~2020 | Smaller bundle (only imports used functions), immutable API, first-class TypeScript support |

**Deprecated/outdated:**
- Using `new Date().getTime()` arithmetic for date ranges: error-prone with DST and month boundaries. Use `date-fns` functions.
- Dashboard polling patterns: unnecessary in single-user apps with mutation control. Only needed when external data sources can change (multi-user, webhooks).

## Open Questions

1. **Prisma enum sort order for Priority**
   - What we know: The `Priority` enum is defined as `LOW, MEDIUM, HIGH` in the Prisma schema. PostgreSQL stores enums with an internal ordinal based on creation order.
   - What's unclear: Whether `orderBy: { priority: "desc" }` in Prisma sorts by the ordinal (giving HIGH first) or alphabetically.
   - Recommendation: Test empirically during implementation. If the sort is wrong, apply a JavaScript sort after fetching the 5 weekly focus goals: `goals.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority])` where `PRIORITY_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 }`.

2. **shadcn Card component installation**
   - What we know: The project uses `npx shadcn@latest add <component>` for codegen (components are copied into the project, not imported from a package).
   - What's unclear: Whether `Card` is already installed (it was not found in the `components/ui/` directory listing).
   - Recommendation: Run `npx shadcn@latest add card` as a Wave 0 task. If it is already present, the command is idempotent.

3. **Streaks & Stats widget scope for Phase 4**
   - What we know: DASH-04 requires "active streaks, goals completed this month, completion rate, current XP/level." XP, levels, and streaks are Phase 9 (gamification) features. UserStats model exists but will not be populated until Phase 9.
   - What's unclear: How much of the gamification data to display vs placeholder in Phase 4.
   - Recommendation: Show "Goals completed this month" and "Completion rate" (computable from goal data now). Show XP as 0 and Level as 1 with a muted "Coming soon" or simply omit XP/level until Phase 9 populates them. Display streak as 0 with a muted style. This avoids building gamification logic prematurely while still filling the widget layout.

## Sources

### Primary (HIGH confidence)
- Existing codebase (direct file reads): Prisma schema, goal service (`goalService.logProgress`, `goalService.getProgressHistory`), progress API routes (`/api/goals/[id]/progress`), React Query hooks, UI store, GoalDetail component, nav config, constants
- TanStack Query v5 docs (https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation): Invalidation from mutations, `invalidateQueries` matching behavior
- TanStack Query v5 docs (https://tanstack.com/query/v5/docs/react/guides/invalidations-from-mutations): onSuccess callback pattern for cross-query invalidation

### Secondary (MEDIUM confidence)
- date-fns v4 release blog (https://blog.date-fns.org/v40-with-time-zone-support/): Confirmed v4 API stability, no breaking changes from v3 for the functions needed
- Phase 3 RESEARCH.md: Confirmed project patterns for React Query hooks, Zustand store, service layer architecture, and shadcn component usage

### Tertiary (LOW confidence)
- Prisma PostgreSQL enum sort order: Based on training data that PostgreSQL sorts enums by their creation ordinal. Needs empirical validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all libraries already installed, patterns directly observed in existing codebase
- Architecture: HIGH, dashboard service + API route + React Query hook follows the exact pattern used for goals and categories in Phases 1 through 3
- Pitfalls: HIGH, derived from direct code analysis (mutation invalidation gaps, empty state handling, enum sort behavior, missing UserStats records)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries, no fast-moving dependencies)
