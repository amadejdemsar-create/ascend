# Analytics Trend Charts

**Slug**: analytics-trends
**Created**: 13. 4. 2026
**Status**: planning

## Problem

The dashboard shows the current state (this week's score, total completed, completion rate) but not trajectory. The user cannot answer: "Am I completing more goals this month than last month?", "Is my XP curve accelerating or flattening?", "Which weeks were my most productive?" Without trend data, there is no feedback loop on improvement over time.

## User Story

As a user, I want to see trend charts of my completion rate, XP earned, and todo throughput over time so that I can understand whether I am improving, stagnating, or regressing.

## Success Criteria

- [ ] A dedicated `/analytics` page accessible from the sidebar
- [ ] Three trend charts, each showing 12 weeks of weekly data:
  1. **Todo completion**: todos completed per week (bar chart)
  2. **XP earned**: cumulative or per-week XP (area chart)
  3. **Goal progress velocity**: number of goals that changed progress per week (line chart)
- [ ] Each chart shows week labels on the x-axis (e.g., "W14", "W15") and values on the y-axis
- [ ] A summary row above the charts with current-week vs previous-week comparison (delta arrows: up green, down red)
- [ ] Charts render with recharts (new dependency)

## Affected Layers

- **Prisma schema**: none (all data exists in Todo.completedAt, XpEvent.createdAt, ProgressLog.createdAt)
- **Service layer**: new `lib/services/analytics-service.ts`
- **API routes**: new `GET /api/analytics`
- **React Query hooks**: new `lib/hooks/use-analytics.ts`
- **UI components**: new `app/(app)/analytics/page.tsx`, new `components/analytics/` folder with chart components
- **MCP tools**: none
- **Zustand store**: none
- **Dependencies**: add `recharts` to `package.json`

## Data Model Changes

None. All trend data comes from existing timestamps on Todo, XpEvent, and ProgressLog.

## API Contract

### GET /api/analytics?weeks=12

Response shape:
```json
{
  "weeks": 12,
  "todoCompletions": [
    { "week": "W3", "weekStart": "2026-01-13", "count": 8 },
    { "week": "W4", "weekStart": "2026-01-20", "count": 12 }
  ],
  "xpEarned": [
    { "week": "W3", "weekStart": "2026-01-13", "amount": 150 },
    { "week": "W4", "weekStart": "2026-01-20", "amount": 280 }
  ],
  "goalProgress": [
    { "week": "W3", "weekStart": "2026-01-13", "goalsProgressed": 2 },
    { "week": "W4", "weekStart": "2026-01-20", "goalsProgressed": 5 }
  ],
  "summary": {
    "todosThisWeek": 12,
    "todosPrevWeek": 8,
    "xpThisWeek": 280,
    "xpPrevWeek": 150,
    "goalsProgressedThisWeek": 5,
    "goalsProgressedPrevWeek": 2
  }
}
```

## UI Flows

**Entry point:** "Analytics" in sidebar navigation (after Review, before Context).

**Analytics page:**
1. Header: "Analytics" h1, subtitle with date range ("Last 12 weeks")
2. Summary row: 3 stat cards showing this-week value with delta arrow vs previous week
3. Three charts stacked vertically (or 2-column grid on wide screens):
   - Todo completions bar chart (blue bars)
   - XP earned area chart (purple gradient fill)
   - Goal progress velocity line chart (green line with dots)
4. Each chart has a `CardHeader` with title and a `CardContent` with the recharts component
5. Responsive: charts fill available width, minimum height 200px

## Cache Invalidation

Read-only feature. The `useAnalytics` query is invalidated when `queryKeys.todos.all()` or `queryKeys.goals.all()` are invalidated (since completions change the data). Add `queryKeys.analytics()` key and invalidate it from the relevant mutation hooks, OR rely on a reasonable staleTime (5 min) since trend data is not real-time critical.

Approach: use a 5-minute staleTime on the analytics query. No cross-domain invalidation needed.

## Danger Zones Touched

None. Read-only aggregation of existing timestamped data.

## Out of Scope

- Filtering by category or horizon (show all data, filter can be added later)
- Daily granularity (weekly is sufficient for trend visualization)
- Export to CSV or image
- Goal-level drill-down (click a bar to see which todos)
- Custom date ranges (fixed at 12 weeks)

## Open Questions

None.
