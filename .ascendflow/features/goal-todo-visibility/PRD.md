# Goal → Todo Linked Visibility

**Slug**: goal-todo-visibility
**Created**: 13. 4. 2026
**Status**: planning

## Problem

Ascend's core concept is inputs (todos) drive outputs (goals). The `goalId` FK on Todo exists and todos can be linked to goals, but the goal detail panel shows no indication of which todos are contributing to a goal. A user opens a goal, wants to see "what am I doing to move this forward?", and has no answer. The inputs → outputs connection is invisible.

## User Story

As a user, I want to see all linked todos when viewing a goal so that I can understand what inputs are driving this output and whether I'm making progress.

## Success Criteria

- [ ] Goal detail panel shows a "Linked Todos" section listing all todos with `goalId` matching the current goal
- [ ] Each todo shows title, status (with visual indicator), priority, and due date
- [ ] Pending todos show a completion toggle (circle button, matching the H6 pattern from todo list)
- [ ] Completing a todo from the goal detail panel triggers the standard completion flow (XP, goal progress recalc, cache invalidation)
- [ ] The section shows a count in the heading ("Linked Todos (3)")
- [ ] Empty state: "No todos linked to this goal. Link a todo from the Todos page."
- [ ] The section is positioned between the Measurable Target and Deadline sections in the goal detail

## Affected Layers

- **Prisma schema**: none (goalId FK already exists on Todo)
- **Service layer**: none (todoService.list already supports goalId filter)
- **API routes**: none (/api/todos?goalId=X already works)
- **React Query hooks**: none (useTodos({ goalId }) already works)
- **UI components**: `components/goals/goal-detail.tsx` (add section), new `components/goals/goal-linked-todos.tsx`
- **MCP tools**: none
- **Zustand store**: none

## Data Model Changes

None. The `Todo.goalId` FK and the `todoService.list(userId, { goalId })` filter already exist.

## API Contract

No new routes needed. Existing: `GET /api/todos?goalId=<id>` returns todos linked to the goal.

## UI Flows

**Goal detail panel** (`components/goals/goal-detail.tsx`):
1. New "Linked Todos" section between the Measurable Target section and Deadline section
2. Uses `useTodos({ goalId })` to fetch todos linked to this goal
3. Renders a `GoalLinkedTodos` component with:
   - Section heading: "Linked Todos (N)" with a small count
   - List of todo rows, each showing: completion circle, title (strikethrough if done), priority badge, due date
   - Clicking the completion circle calls `useCompleteTodo` / `useUncompleteTodo` (same pattern as H6 todo list)
   - Empty state when no todos linked

## Cache Invalidation

Completing a todo from within the goal detail must invalidate:
- `queryKeys.todos.all()` (todo was modified)
- `queryKeys.goals.all()` (goal progress may change via gamification side effects)
- `queryKeys.dashboard()` (dashboard widgets reflect completion)

These invalidations are already handled by the existing `useCompleteTodo` / `useUncompleteTodo` hooks.

## Danger Zones Touched

**No transaction wrapping in todo completion** (from CLAUDE.md). Completing a todo from the goal detail uses the same `useCompleteTodo` hook, which calls `POST /api/todos/:id/complete`. The non-transactional risk is pre-existing and not made worse by this feature.

## Out of Scope

- Adding a "Link todo" button from the goal detail (user links from the todo side)
- Inline creation of a new todo from the goal detail
- Showing completed vs pending count or a mini progress bar (can be added later)
- Filtering the linked todos (show all, let the list be short)

## Open Questions

None. The data layer is fully ready; this is a pure UI feature.
