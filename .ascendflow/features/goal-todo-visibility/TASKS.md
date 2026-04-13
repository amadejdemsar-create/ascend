# Implementation Tasks: Goal → Todo Linked Visibility

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: UI component

- [ ] Create `components/goals/goal-linked-todos.tsx`. Props: `goalId: string`. Internally calls `useTodos({ goalId })` from `lib/hooks/use-todos.ts` to fetch linked todos. Also calls `useCompleteTodo()` and `useUncompleteTodo()` from the same hook file for the completion toggle. Renders:
  - Section heading with count: `Linked Todos ({count})`
  - A list of todo rows, each with: completion circle button (matching the pattern in `components/todos/todo-list-columns.tsx` cell renderer), title (strikethrough + muted if DONE), `GoalPriorityBadge` from `components/goals/goal-priority-badge.tsx`, and due date formatted with `date-fns format()`.
  - Empty state: `<p className="text-sm text-muted-foreground">No todos linked to this goal. Link a todo from the Todos page.</p>`
  - Loading state: 3 `Skeleton` rows from `components/ui/skeleton.tsx`
  - Toast feedback on complete/uncomplete using `sonner` toast

## Phase 2: Wire into goal detail

- [ ] Edit `components/goals/goal-detail.tsx`: import `GoalLinkedTodos` from `./goal-linked-todos`. Add `<GoalLinkedTodos goalId={goalId} />` between the Measurable Target section (line ~427, after the `</div>` closing the target section) and the Deadline section. Add a `<Separator />` before it for visual separation.

## Phase 3: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Run `/ax:verify-ui` on the goals page to confirm the linked todos section renders, completion toggle works, and no console errors appear.
- [ ] Run `/ax:review` to audit against safety rules.
