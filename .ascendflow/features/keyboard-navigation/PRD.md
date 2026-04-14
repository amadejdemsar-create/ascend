# Keyboard-First Navigation (Vim-style)

**Slug**: keyboard-navigation
**Created**: 14. 4. 2026
**Status**: planning

## Problem

Ascend has app-level keyboard shortcuts (1/2/3 for views, d/s for pages, n for new goal, ? for help) defined in `lib/hooks/use-keyboard-shortcuts.ts`, but no in-list navigation. A power user wanting to complete 5 todos quickly has to click each one. Adding vim-style j/k navigation + Enter to open + x to complete transforms the flow from pointer-driven to keyboard-driven, which is the highest-leverage productivity multiplier for daily use.

## User Story

As a keyboard-first user, I want to navigate lists with j/k, open details with Enter, and complete items with x, so that I can run my daily workflow without touching the mouse.

## Success Criteria

- [ ] On the goals list view, pressing `j` moves focus down, `k` moves focus up. The focused row shows a ring or highlighted background.
- [ ] On the todos list view, same `j`/`k` behavior. `x` toggles completion on the focused todo. `Enter` opens the detail panel.
- [ ] On the context entry list, same `j`/`k` + `Enter`.
- [ ] The focused row scrolls into view automatically as it moves off-screen.
- [ ] `Esc` closes the currently open detail panel (goal detail, todo detail, context entry detail).
- [ ] All shortcuts are disabled when typing in an input, textarea, or contenteditable.
- [ ] The keyboard shortcuts dialog (`?` key) lists the new shortcuts in a new "In-list" group.
- [ ] Navigation is page-scoped: j/k on goals doesn't affect todos, and vice versa.

## Affected Layers

- **Prisma schema**: none
- **Service layer**: none
- **API routes**: none
- **React Query hooks**: none
- **UI components**: new `lib/hooks/use-list-navigation.ts`, modified `components/goals/goal-list-view.tsx`, `components/todos/todo-list-view.tsx`, `components/context/context-entry-list.tsx`, `components/command-palette/keyboard-shortcuts.tsx` (add new group), and possibly `lib/hooks/use-keyboard-shortcuts.ts` for the global Esc handler
- **MCP tools**: none
- **Zustand store**: none (keyboard focus is ephemeral UI state, not persisted)

## Data Model Changes

None.

## Hook Contract

```ts
// lib/hooks/use-list-navigation.ts

export interface UseListNavigationOptions<T> {
  items: T[]; // ordered list to navigate
  getId: (item: T) => string;
  onOpen?: (item: T) => void; // Enter handler
  onComplete?: (item: T) => void; // x handler (optional per list)
  enabled?: boolean; // skip when false (default true)
  scrollToFocused?: boolean; // default true; scrolls the focused row into view
}

export interface UseListNavigationResult {
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
}

export function useListNavigation<T>(
  options: UseListNavigationOptions<T>
): UseListNavigationResult;
```

Internal behavior:
- Keep focused index as local state
- Add `document.addEventListener("keydown")` in a `useEffect`
- When `enabled === false`, do not attach listeners
- Guard against inputs/textareas/contenteditable (same logic as `use-keyboard-shortcuts.ts`)
- On `j`: increment focus, clamp at `items.length - 1`
- On `k`: decrement, clamp at 0
- On `Enter`: call `onOpen(items[focusedIndex])`
- On `x`: call `onComplete?.(items[focusedIndex])` if provided
- When items change (length or ids): keep focus on same id if possible; otherwise focus item 0
- `scrollToFocused`: after each key-driven change, call `.scrollIntoView({ block: "nearest" })` on the row DOM element (look up by data attribute or ref map)

## UI Flows

### Goals list
- Each row in `components/goals/goal-list-view.tsx` gets a `data-list-item-id={goal.id}` attribute
- The view wires `useListNavigation({ items: goals, getId: (g) => g.id, onOpen: (g) => selectGoal(g.id) })`
- Focused row class: `ring-2 ring-primary ring-inset` via `cn()` when `focusedId === goal.id`
- No `x` handler for goals — goals don't have a simple complete toggle (they go through the goal modal)

### Todos list
- Same pattern. `onComplete` = `completeTodo.mutateAsync(todo.id)` if PENDING, `uncompleteTodo.mutateAsync(todo.id)` if DONE
- Focused row highlighted with `bg-muted/50`

### Context entry list
- Same pattern. `onOpen` selects the entry
- No `x` handler

### Global Esc handler
In `lib/hooks/use-keyboard-shortcuts.ts`, add an `Escape` branch that:
- If `useUIStore.getState().selectedGoalId` → `selectGoal(null)`
- Else if the URL is `/todos` and a todo is selected → unset it (the todos page manages local selection state; may require a store migration or a global escape handler exposed via useUIStore)
- Else if the URL is `/context` → clear the selected entry

Simpler: add a `globalEscape` callback field in UI store that components can register. Or: have each page register its own Esc handler via a utility. Implementation detail; pick whichever is cleanest.

For v1: just handle goal detail close (already in useUIStore), and let the todo / context pages add their own Esc handlers locally.

## Cache Invalidation

None (hook is UI-only; existing mutations handle their own invalidation).

## Danger Zones Touched

None. Pure UI layer.

## Out of Scope

- Vim-style `g g` / `G` (jump to top / bottom) — can be added later
- `/` to open command palette (already `Cmd+K`)
- Multi-select with `V` + j/k range
- Arrow key navigation as an alternative to j/k (j/k only; arrow keys remain free for form inputs)
- Keyboard navigation inside the calendar grid (complex, separate feature)
- Keyboard navigation in the goal tree or timeline views (list view only for v1)

## Open Questions

None.
