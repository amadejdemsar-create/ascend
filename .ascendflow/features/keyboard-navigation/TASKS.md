# Implementation Tasks: Keyboard-First Navigation

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Generic list navigation hook

- [ ] Create `lib/hooks/use-list-navigation.ts` exporting `useListNavigation<T>(options)` (see PRD hook contract). Internal behavior:
  - `useState` for `focusedId: string | null`, initialized to `items[0]?.id ?? null`
  - `useEffect` that attaches a `keydown` listener on `document`. Guards:
    - Skip when `options.enabled === false`
    - Skip when `e.target` is an INPUT, TEXTAREA, SELECT, or contentEditable
    - Skip when `e.metaKey` or `e.ctrlKey` pressed (to avoid interfering with Cmd+K etc.)
  - Key handlers:
    - `j` or `ArrowDown` (if not in input): move focus down
    - `k` or `ArrowUp`: move focus up
    - `Enter`: call `onOpen(focusedItem)` if present
    - `x`: call `onComplete?.(focusedItem)` if present; do nothing otherwise (so lists without x wiring don't steal the key)
  - When items change: preserve focus if the previously-focused id still exists; else move to index 0 or null
  - Scroll-into-view: after each move, find the element via `document.querySelector(\`[data-list-item-id="${newId}"]\`)` and call `.scrollIntoView({ block: "nearest" })` if `scrollToFocused !== false`
  - Dependencies: `items`, `onOpen`, `onComplete`, `enabled` in the useEffect dep array
  - Return `{ focusedId, setFocusedId }`

## Phase 2: Wire into goal list view

- [ ] Edit `components/goals/goal-list-view.tsx`. Import `useListNavigation`. Call it with:
  ```ts
  const selectGoal = useUIStore((s) => s.selectGoal);
  const goals = table.getRowModel().rows.map((r) => r.original);
  const { focusedId } = useListNavigation({
    items: goals,
    getId: (g) => g.id,
    onOpen: (g) => selectGoal(g.id),
  });
  ```
  Add `data-list-item-id={row.original.id}` to the `<SortableGoalRow>` or the underlying `<TableRow>`. Add conditional class `focusedId === row.original.id && "ring-2 ring-primary ring-inset"` to that row via `cn()`.

## Phase 3: Wire into todo list view

- [ ] Edit `components/todos/todo-list-view.tsx`. Import `useListNavigation`. The page already passes `onSelect`, `selectedId`, and the completion toggle handlers through `meta`. Use those:
  ```ts
  const { focusedId } = useListNavigation({
    items: todos,
    getId: (t) => t.id,
    onOpen: (t) => onSelect(t.id),
    onComplete: (t) => {
      if (t.status === "PENDING") meta.completeTodo(t.id);
      else if (t.status === "DONE") meta.uncompleteTodo(t.id);
    },
  });
  ```
  Add `data-list-item-id={row.original.id}` on the `<TableRow>`. Conditional class for focus ring.

## Phase 4: Wire into context entry list

- [ ] Edit `components/context/context-entry-list.tsx`. Import `useListNavigation`. It already has `onSelect(id)` prop. Wire:
  ```ts
  const { focusedId } = useListNavigation({
    items: entries,
    getId: (e) => e.id,
    onOpen: (e) => onSelect(e.id),
  });
  ```
  Add `data-list-item-id={entry.id}` and the focus-ring class on each entry card.

## Phase 5: Global Esc handler for detail panels

- [ ] Edit `lib/hooks/use-keyboard-shortcuts.ts`. Add an `Escape` case:
  ```ts
  case "Escape": {
    const { selectedGoalId, selectGoal } = useUIStore.getState();
    if (selectedGoalId) {
      e.preventDefault();
      selectGoal(null);
      return;
    }
    // Other page-level handlers can listen on their own
    break;
  }
  ```
  For todos and context, their pages use local state for selection; they can add their own Esc handlers if desired, but that's out of v1 scope (noted in PRD). The goal detail is the most common case.

## Phase 6: Document in the keyboard shortcuts dialog

- [ ] Edit `components/command-palette/keyboard-shortcuts.tsx`. Add a new group at the top (before "Navigation"):
  ```ts
  {
    title: "In-list",
    shortcuts: [
      { key: "j", description: "Move down" },
      { key: "k", description: "Move up" },
      { key: "Enter", description: "Open detail" },
      { key: "x", description: "Toggle complete (todos)" },
    ],
  }
  ```
  Also: update the settings-shortcuts-section.tsx (if it exists) that mirrors this list.

- [ ] Edit `components/settings/shortcuts-section.tsx` to add the same "In-list" group so the settings page reflects the new shortcuts.

## Phase 7: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Manually verify:
  - On `/goals`, press j/k, the focused row highlights with a ring. Enter opens the detail panel. Esc closes it.
  - On `/todos`, j/k works the same way. x on a pending todo marks it done (and vice versa). Visual feedback confirms completion.
  - On `/context`, j/k works and Enter opens the entry.
  - Typing in any input — j/k no longer navigate (they just type). Keys return to working when input loses focus.
  - The `?` dialog shows the new "In-list" section.
- [ ] Run `/ax:review` for safety audit.
