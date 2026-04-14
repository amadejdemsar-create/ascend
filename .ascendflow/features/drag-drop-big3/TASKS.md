# Implementation Tasks: Drag and Drop Big 3

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Sub-components

- [ ] Create `components/calendar/big3-slot.tsx`. A droppable slot component using `@dnd-kit/react`'s `useDroppable` hook. Props:
  ```ts
  interface Big3SlotProps {
    slotIndex: 0 | 1 | 2;
    todo: TodoListItem | null;
    onRemove: () => void;
  }
  ```
  Renders:
  - Empty: a dashed-border card ~120px tall with muted "#{slotIndex + 1}" label and "Drop a todo here" text, plus a subtle Target icon.
  - Filled: the todo title + GoalPriorityBadge + X button to remove
  - When `isOver` (drag hovering): highlight background to `bg-primary/10` and border-primary
  
  The drop id should be `"slot-{slotIndex}"`.

- [ ] Create `components/calendar/big3-draggable-todo.tsx`. A draggable todo card using `@dnd-kit/react`'s `useSortable` or `useDraggable`. Props:
  ```ts
  interface DraggableTodoProps {
    todo: TodoListItem;
  }
  ```
  Renders a compact todo card: Star (if isBig3 pre-existing) + title + priority badge + category dot. `cursor-grab` when idle, `cursor-grabbing` when dragging, `opacity-50` when being dragged.

## Phase 2: Refactor morning-planning-prompt

- [ ] Edit `components/calendar/morning-planning-prompt.tsx`. Replace the click-to-select flow with drag-and-drop. Pattern (read `components/goals/dnd-goal-provider.tsx` or `goal-list-view.tsx` for how `@dnd-kit/react` is used here — both import from `@dnd-kit/react`).

  State:
  ```ts
  const [slots, setSlots] = useState<Array<TodoListItem | null>>([null, null, null]);
  const [pool, setPool] = useState<TodoListItem[]>(initialPool); // the draggable list
  ```
  
  Drag handler: on drop, determine source (slot N or pool) and target (slot N or pool).
  - Pool → slot: remove from pool, if slot was occupied move occupant back to pool, place new todo in slot
  - Slot → slot: swap or move
  - Slot → pool: remove from slot, prepend to pool

  Wrap the body in the `@dnd-kit/react`-compatible provider (match the pattern used in `goal-list-view.tsx` which already uses `@dnd-kit/react` `useSortable`). If the codebase uses a top-level `<DragDropProvider>` or equivalent from `@dnd-kit/react`, import it; otherwise follow the API used in `goal-list-view.tsx` for sortable-only (no wrapping provider needed for basic drag between two lists).

  Layout:
  - Top: 3 slot cards in a `grid grid-cols-3 gap-2`
  - Middle: draggable pool, `flex flex-wrap gap-2`
  - Bottom: "Set Big 3 ({filledCount}/3)" button + Skip button

  On "Set Big 3" click:
  ```ts
  const todoIds = slots.filter((t): t is TodoListItem => t !== null).map((t) => t.id);
  await setBig3.mutateAsync({ todoIds });
  ```

## Phase 3: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Manually verify:
  - Morning planning prompt shows 3 slots + pool of todos
  - Drag a todo from pool into slot #1 → slot fills
  - Drag another todo onto slot #1 → previous occupant returns to pool, new one fills slot
  - Drag todo from slot back to pool → slot becomes empty
  - Click "Set Big 3" with 2 todos → creates Big 3 correctly (verify via dashboard widget or database)
- [ ] Run `/ax:review` for safety audit.
