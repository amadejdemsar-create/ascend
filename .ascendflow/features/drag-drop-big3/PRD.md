# Drag and Drop Big 3

**Slug**: drag-drop-big3
**Created**: 14. 4. 2026
**Status**: planning

## Problem

Setting Big 3 today is a click-to-select flow in the morning planning prompt (`components/calendar/morning-planning-prompt.tsx`): click up to 3 todos to mark them, then hit "Set Big 3". It works, but it's not visually engaging or satisfying. A drag-and-drop picker with 3 explicit slots makes the ritual tactile and intentional: the user physically moves their three priorities into dedicated containers.

## User Story

As a user, I want to drag three todos into three labeled Big 3 slots so that picking my daily priorities feels intentional and satisfying.

## Success Criteria

- [ ] Three explicit "Big 3" drop-zone slots labeled #1, #2, #3 at the top of the morning planning prompt
- [ ] Pending todos for today appear below as a draggable list
- [ ] Dragging a todo onto a slot fills the slot; empty slots show a "Drop a todo here" placeholder
- [ ] Dragging a todo onto an already-filled slot swaps them (the previous occupant returns to the list)
- [ ] Dragging a todo in a slot back to the list (or to another slot) removes it from that slot
- [ ] An X button on each filled slot removes the todo from the slot (returns to list)
- [ ] "Set Big 3" button at the bottom is disabled until at least 1 slot is filled; enabled with 1-3 filled slots
- [ ] Clicking "Set Big 3" calls `useSetBig3` with the slot order preserved (slot #1 = first in the array)
- [ ] Visual feedback: slots highlight when hovered over during drag; drop animation pulses green on success
- [ ] Keyboard accessibility: slots and todos are keyboard-focusable, Space/Enter to pick up, arrows to move, Space/Enter to drop (via dnd-kit's built-in keyboard sensor)

## Affected Layers

- **Prisma schema**: none
- **Service layer**: none (uses existing `setBig3` method)
- **API routes**: none
- **React Query hooks**: none (uses existing `useSetBig3`)
- **UI components**: modify `components/calendar/morning-planning-prompt.tsx` (replace click-select with dnd); possibly add `components/calendar/big3-slot.tsx` and `components/calendar/big3-draggable-todo.tsx` as sub-components
- **MCP tools**: none
- **Zustand store**: none

## Data Model Changes

None.

## UI Flows

**Morning planning prompt (`components/calendar/morning-planning-prompt.tsx`):**

1. Header: "Pick your 3 priorities for today" (swap the existing "Pick up to 3 priorities")
2. Big 3 slots row: three side-by-side slot cards labeled "#1 Most important", "#2", "#3"
   - Empty slot: dashed border + "Drop a todo here" placeholder text
   - Filled slot: todo title + priority badge + X button to remove
3. Todo list below: flex-wrap grid of draggable todo cards (pending today's todos)
4. Footer buttons: "Set Big 3 (N/3)" primary button + "Skip for now" ghost button

**Drag interactions (using `@dnd-kit/react`):**

- Source items: todo cards in the list (draggable)
- Drop targets: the 3 slot cards (droppable)
- When a todo is dropped on a slot:
  - If slot is empty, add todo to that slot
  - If slot is occupied, swap: move occupant back to the list, put the new one in
- When a todo in a slot is dropped on another slot: move it (empty original if it becomes empty, swap if target occupied)
- When a todo in a slot is dragged onto the list area (or outside all slots): remove from slot, return to list
- `<DragOverlay>` shows a visual preview during drag

## Cache Invalidation

`useSetBig3` already invalidates `queryKeys.todos.all()` and `queryKeys.todos.big3()`.

## Danger Zones Touched

None directly. `@dnd-kit/react` is already used in `components/goals/goal-list-view.tsx` so the library is proven.

## Out of Scope

- Drag-and-drop reordering of existing Big 3 (users set once per day)
- Dragging todos directly from other pages (goals, todos, dashboard) into Big 3
- Multi-day Big 3 planning (set Big 3 for tomorrow in advance)
- Mobile-specific gestures beyond dnd-kit's default touch support
- Undo after setting Big 3 (users can re-run the set with a different set of todoIds to replace)

## Open Questions

None.
