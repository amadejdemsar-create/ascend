# Streak / Consistency Heatmap

**Slug**: streak-heatmap
**Created**: 13. 4. 2026
**Status**: planning

## Problem

Recurring todos track `currentStreak`, `longestStreak`, and `consistencyScore`, but there is no visualization. The user sees "14 day streak" as a number in the todo detail panel but has no sense of the pattern: which days were completed, which missed, how consistency has trended over time. A GitHub-style contribution heatmap makes streaks feel tangible and rewarding instead of abstract.

## User Story

As a user, I want to see a visual heatmap of my recurring todo completions so that I can spot patterns, feel motivated by green streaks, and identify which days I tend to miss.

## Success Criteria

- [ ] A heatmap component showing the last 90 days (roughly 13 weeks) as a grid of colored squares
- [ ] Each day cell colored: green for completed, empty/gray for no instance, red for missed (instance existed but was not completed)
- [ ] Shows on the todo detail panel for recurring todos (when `todo.isRecurring` or `todo.recurringSourceId`)
- [ ] Hovering a cell shows the date and status in a tooltip
- [ ] Current streak and longest streak shown as labels above the heatmap
- [ ] The heatmap fetches completion history for the recurring template (the source todo, not individual instances)

## Affected Layers

- **Prisma schema**: none (completion data exists on individual todo instances via `completedAt` and `recurringSourceId`)
- **Service layer**: add `getCompletionHistory(userId, templateId, days)` to `lib/services/todo-recurring-service.ts`
- **API routes**: new `GET /api/todos/[id]/streak-history` route
- **React Query hooks**: add `useStreakHistory(todoId)` to `lib/hooks/use-todos.ts`
- **UI components**: new `components/todos/streak-heatmap.tsx`, wire into `components/todos/todo-detail.tsx`
- **MCP tools**: none
- **Zustand store**: none

## Data Model Changes

None. Individual recurring instances are Todo rows with `recurringSourceId` pointing to the template. Their `completedAt` field (non-null if completed) and `dueDate` (the scheduled date) provide the per-day history.

## API Contract

### GET /api/todos/[id]/streak-history?days=90

Returns completion history for the recurring todo template.

Response shape:
```json
{
  "templateId": "abc123",
  "currentStreak": 14,
  "longestStreak": 21,
  "consistencyScore": 0.82,
  "days": [
    { "date": "2026-04-13", "status": "completed" },
    { "date": "2026-04-12", "status": "completed" },
    { "date": "2026-04-11", "status": "missed" },
    { "date": "2026-04-10", "status": "none" }
  ]
}
```

Status values: `"completed"` (instance exists with completedAt set), `"missed"` (instance exists without completedAt, dueDate in the past), `"none"` (no instance for this date, not a scheduled day).

## UI Flows

**Todo detail panel** (`components/todos/todo-detail.tsx`):
1. For recurring todos, show a new "Streak" section below the recurring info block
2. Renders the `StreakHeatmap` component
3. The heatmap is a grid: 7 rows (Mon through Sun, week starts Monday) by ~13 columns (weeks)
4. Each cell is a small square (~12x12px) with rounded corners
5. Color scale: `bg-muted` (no instance), `bg-green-500` (completed), `bg-red-400/60` (missed/pending past due)
6. Left labels: M, T, W, T, F, S, S
7. Bottom labels: month abbreviations at week boundaries
8. Above the grid: "Current streak: {N}" and "Longest: {N}" and "Consistency: {N}%"
9. Tooltip on hover: "13. 4. 2026: Completed" or "11. 4. 2026: Missed"

## Cache Invalidation

Read-only feature. `useStreakHistory` is a query, not a mutation. Invalidated automatically when `queryKeys.todos.all()` is invalidated (after todo completion), since the query key includes the todo ID.

## Danger Zones Touched

**Two separate recurring systems** (CLAUDE.md). This feature reads from the todo recurring system only (`recurringSourceId` on Todo model). Does not touch goal recurrence. The `todo-recurring-service.ts` is the correct place for the new method.

**Recurring instance generation is visit-triggered.** The heatmap reads existing instances. If instances were never generated (user never visited calendar for a past month), those days will show as "none" instead of "missed." This is acceptable: the data accurately reflects what was generated. Documenting this as a known limitation, not a bug.

## Out of Scope

- Goal streak heatmaps (goals also have streaks but are less frequent; can be added later)
- Editing or retroactively marking days as completed
- Streak recovery ("fill in yesterday")
- Animated transitions or celebrations on streak milestones

## Open Questions

None.
