# Weekly Review

**Slug**: weekly-review
**Created**: 13. 4. 2026
**Status**: planning

## Problem

Ascend tracks goals, todos, streaks, and XP, but there is no structured moment for reflection. The user has to mentally piece together what happened this week by clicking through different pages. Without a guided review, the system becomes a tracking tool instead of an operating system. A weekly review is what turns passive tracking into active reflection and intentional planning.

## User Story

As a user, I want a guided weekly review that shows what I accomplished, what carried over, and how my goals progressed so that I can reflect on the week and plan the next one with clarity.

## Success Criteria

- [ ] A "Weekly Review" page or modal accessible from dashboard and calendar
- [ ] Shows the week's stats: todos completed, todos carried over (still pending from this week), goals completed, goals progressed, XP earned, Big 3 hit rate
- [ ] Lists completed todos and goals for the week
- [ ] Lists carried-over todos (pending, due this week or earlier)
- [ ] Shows goal progress deltas (which goals moved forward and by how much)
- [ ] Provides a "What went well" and "What to improve" free-text reflection section
- [ ] Has a "Save Review" action that creates a context document with the review as a permanent artifact
- [ ] Shows the review for any past week (not just current), navigable by week

## Affected Layers

- **Prisma schema**: none (uses existing models; review saved as ContextEntry)
- **Service layer**: new `lib/services/review-service.ts` for weekly aggregation
- **API routes**: new `app/api/review/route.ts` (GET with week param) and `app/api/review/save/route.ts` (POST to save as context)
- **React Query hooks**: new `lib/hooks/use-review.ts` with `useWeeklyReview(weekStart)` and `useSaveReview()`
- **UI components**: new `app/(app)/review/page.tsx`, new `components/review/weekly-review-page.tsx` and sub-components
- **MCP tools**: none (could add later)
- **Zustand store**: none

## Data Model Changes

None. The review is an aggregation of existing data. Saving a review creates a `ContextEntry` with a tag `["weekly-review"]` and a title like "Weekly Review: 7. 4. 2026 to 13. 4. 2026".

## API Contract

### GET /api/review?weekStart=2026-04-07

Returns aggregated data for the week starting on Monday `weekStart`.

Response shape:
```json
{
  "weekStart": "2026-04-07",
  "weekEnd": "2026-04-13",
  "stats": {
    "todosCompleted": 12,
    "todosCarriedOver": 3,
    "goalsCompleted": 1,
    "goalsProgressed": 4,
    "xpEarned": 250,
    "big3Days": 5,
    "big3Total": 7
  },
  "completedTodos": [{ "id", "title", "completedAt", "goal" }],
  "carriedOverTodos": [{ "id", "title", "dueDate", "priority", "goal" }],
  "goalProgressDeltas": [{ "id", "title", "progressStart", "progressEnd", "delta" }],
  "completedGoals": [{ "id", "title", "horizon", "completedAt" }]
}
```

### POST /api/review/save

Request body:
```json
{
  "weekStart": "2026-04-07",
  "wentWell": "Shipped the UI review...",
  "toImprove": "Need to plan before coding...",
  "stats": { ... }
}
```

Creates a ContextEntry with the review content formatted as markdown.

## UI Flows

**Entry points:**
1. New nav item "Review" in the sidebar (between Calendar and Context)
2. Dashboard CTA: "Start your weekly review" button (shows on Monday or when no review exists for last week)

**Review page** (`app/(app)/review/page.tsx`):
1. Week selector at top (prev/next arrows, current week highlighted, "This Week" quick button)
2. Stats row: 6 stat cards in a grid (todos completed, carried over, goals completed, goals progressed, XP earned, Big 3 hit rate)
3. "Completed" section: collapsible list of completed todos and goals
4. "Carried Over" section: collapsible list of pending todos from the week
5. "Goal Progress" section: list of goals that changed progress, showing before/after bars
6. "Reflection" section: two text areas ("What went well this week?" and "What to improve next week?")
7. "Save Review" button at bottom: saves as a context document, shows toast confirmation

## Cache Invalidation

- `useSaveReview` mutation invalidates `queryKeys.context.all()` (new context entry created)
- Read-only `useWeeklyReview` does not need invalidation (aggregation query)

## Danger Zones Touched

None directly. The review is a read-only aggregation of existing data. The save action creates a context entry through `contextService.create`, which handles the `search_vector` tsvector via a Prisma middleware or trigger (existing pattern).

## Out of Scope

- Automatic review reminders/notifications (future notification feature)
- Review templates (future templates feature F6)
- Comparison between weeks ("this week vs last week")
- MCP tool for weekly review (can be added later)
- Editing a previously saved review (create a new one instead)

## Open Questions

None. All data sources exist. The aggregation is straightforward date-range queries.
