# Phase 8: Drag and Drop - Research

**Researched:** 2026-03-30
**Domain:** React drag and drop (cross-view reordering, hierarchy changes, visual feedback)
**Confidence:** HIGH

## Summary

Phase 8 adds drag and drop functionality across the List, Board, and Tree views. The primary challenge is not the DnD library itself (which is well solved by `@dnd-kit/react` 0.3.2), but the integration with three fundamentally different view structures: a flat TanStack Table (List), a grouped card layout (Board), and a recursive tree (Tree). Each view needs its own sortable/droppable configuration, but all three must share a unified persistence layer that maps visual reorder operations to `sortOrder` updates and category/horizon changes in the backend.

The existing codebase already has a `sortOrder` field on every `Goal` record and orders by `sortOrder ASC, createdAt DESC`. The `updateGoalSchema` already accepts `sortOrder`, `horizon`, and `categoryId` fields. This means the backend is ready for all three DnD operations (reorder, horizon move, category move) through the existing PATCH endpoint. What is missing is a batch reorder endpoint (to update multiple `sortOrder` values atomically) and the client-side DnD wiring.

**Primary recommendation:** Use `@dnd-kit/react` 0.3.2 with `@dnd-kit/helpers` 0.3.2 for all drag operations. Add a single `POST /api/goals/reorder` endpoint for batch `sortOrder` persistence. Wire DnD at the view level with a shared `DragDropProvider` wrapper, keeping each view's sortable/droppable logic isolated in its own component.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DND-01 | User can reorder goals within a list by dragging | `useSortable` hook with `index` prop provides within-list reorder. `move()` helper from `@dnd-kit/helpers` handles array mutation. Batch reorder API persists new `sortOrder` values. |
| DND-02 | User can move a goal between horizons by dragging (e.g., promote weekly to monthly) | Board view grouped by horizon uses `useSortable` with `group` prop. On `onDragEnd`, detect cross-column drop and PATCH the goal's `horizon` field. Hierarchy validation in `goalService.update` enforces parent-child rules. |
| DND-03 | User can move a goal between categories by dragging | Same mechanism as DND-02 but for `categoryId`. Can be implemented as a droppable sidebar category tree or as board columns grouped by category. PATCH endpoint already accepts `categoryId`. |
| DND-04 | Drag and drop works across List, Board, and Tree views | Each view gets its own `useSortable`/`useDroppable` configuration inside a shared `DragDropProvider`. The provider sits in the goals page layout, wrapping all views. `type` and `accept` props on sortable items scope interactions per view. |
| DND-05 | Visual feedback during drag (ghost element, drop targets highlighted) | `DragOverlay` component renders a custom ghost card. `isDragging` (on source) and `isDropTarget` (on targets) booleans from hooks drive CSS classes for opacity reduction and highlight borders. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/react` | 0.3.2 | React hooks and components for drag and drop | The new stable rewrite of dnd-kit. Framework-specific React adapter built on `@dnd-kit/dom`. Provides `useDraggable`, `useDroppable`, `useSortable`, `DragDropProvider`, `DragOverlay`. |
| `@dnd-kit/helpers` | 0.3.2 | Array manipulation utilities for DnD state updates | Provides `move()`, `swap()`, `arrayMove()`, `arraySwap()` for mutating item arrays in response to drag events. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/abstract` | 0.3.2 | Type exports (`CollisionPriority`) | Imported for `CollisionPriority.Low` when columns/containers need lower priority than items. Auto-installed as dependency of `@dnd-kit/react`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@dnd-kit/react` | `react-beautiful-dnd` / `@hello-pangea/dnd` | Abandoned by Atlassian. Community fork exists but no tree DnD support. dnd-kit is the clear ecosystem winner. |
| `@dnd-kit/react` | HTML5 Drag and Drop API | No touch support, no custom overlays, no sortable primitives, poor accessibility. |
| `@dnd-kit/react` | Legacy `@dnd-kit/core` + `@dnd-kit/sortable` | Old API. The new `@dnd-kit/react` is a complete rewrite with simpler hooks (single `ref` instead of `setNodeRef` + `attributes` + `listeners`). Migration guide exists. |

**Installation:**
```bash
npm install @dnd-kit/react @dnd-kit/helpers
```

Note: `@dnd-kit/react` automatically installs `@dnd-kit/dom` and `@dnd-kit/abstract` as transitive dependencies. No need to install them separately.

## Architecture Patterns

### Recommended Project Structure
```
components/
├── goals/
│   ├── goal-list-view.tsx        # Modified: wrap rows in useSortable
│   ├── goal-board-view.tsx       # Modified: wrap in DragDropProvider, add move logic
│   ├── goal-board-column.tsx     # Modified: useDroppable for column, useSortable for sortable columns
│   ├── goal-board-card.tsx       # Modified: useSortable for card sorting
│   ├── goal-tree-view.tsx        # Modified: useSortable for tree node reorder
│   ├── goal-tree-node.tsx        # Modified: useSortable with group per parent
│   ├── goal-drag-overlay.tsx     # NEW: renders ghost card during drag
│   └── dnd-goal-provider.tsx     # NEW: shared DragDropProvider wrapper with event handlers
├── categories/
│   └── sidebar-category-tree.tsx # Modified: useDroppable on category nodes for DND-03
lib/
├── hooks/
│   └── use-goals.ts              # Modified: add useReorderGoals mutation hook
├── services/
│   └── goal-service.ts           # Modified: add reorderGoals batch method
app/
├── api/
│   └── goals/
│       └── reorder/
│           └── route.ts          # NEW: POST endpoint for batch sortOrder updates
```

### Pattern 1: Shared DragDropProvider at Page Level
**What:** A single `DragDropProvider` wraps the active view. Event handlers (`onDragStart`, `onDragOver`, `onDragEnd`) live in the provider wrapper, dispatching to the appropriate mutation based on what changed (reorder, horizon, category).
**When to use:** Always. Only one DragDropProvider should exist per page.
**Example:**
```typescript
// Source: https://dndkit.com/react/guides/multiple-sortable-lists
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { move } from '@dnd-kit/helpers';

function DndGoalProvider({ children }: { children: React.ReactNode }) {
  const previousItems = useRef(items);

  return (
    <DragDropProvider
      onDragStart={() => {
        previousItems.current = items;
      }}
      onDragOver={(event) => {
        const { source } = event.operation;
        if (source?.type === 'column') return;
        setItems((prev) => move(prev, event));
      }}
      onDragEnd={(event) => {
        if (event.canceled) {
          setItems(previousItems.current);
          return;
        }
        // Persist to backend
        persistReorder(event);
      }}
    >
      {children}
      <DragOverlay>
        {(source) => <GoalDragOverlay sourceId={source.id} />}
      </DragOverlay>
    </DragDropProvider>
  );
}
```

### Pattern 2: useSortable with `group` for Cross-Column Board DnD
**What:** Each board card uses `useSortable` with the column key as the `group` prop. This allows items to be sorted within a column and moved between columns.
**When to use:** Board view (DND-01 reorder + DND-02 horizon change or DND-03 category change depending on grouping).
**Example:**
```typescript
// Source: https://dndkit.com/react/guides/multiple-sortable-lists
import { useSortable } from '@dnd-kit/react/sortable';

function SortableBoardCard({ goal, index, column }: Props) {
  const { ref, isDragging } = useSortable({
    id: goal.id,
    index,
    type: 'goal-card',
    accept: 'goal-card',
    group: column,
  });

  return (
    <div ref={ref} data-dragging={isDragging}>
      <GoalBoardCard goal={goal} />
    </div>
  );
}
```

### Pattern 3: Droppable Columns with Low Collision Priority
**What:** Board columns are droppable targets that accept goal cards. They use `CollisionPriority.Low` so items within them take priority for collision detection.
**When to use:** Board view columns, sidebar category drop targets.
**Example:**
```typescript
// Source: https://dndkit.com/react/guides/multiple-sortable-lists
import { useDroppable } from '@dnd-kit/react';
import { CollisionPriority } from '@dnd-kit/abstract';

function DroppableBoardColumn({ id, children }: Props) {
  const { ref, isDropTarget } = useDroppable({
    id,
    type: 'column',
    accept: 'goal-card',
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <div ref={ref} className={isDropTarget ? 'ring-2 ring-primary' : ''}>
      {children}
    </div>
  );
}
```

### Pattern 4: Batch Reorder API
**What:** A dedicated POST endpoint accepts an array of `{ id, sortOrder }` pairs and updates them in a single transaction. This avoids N individual PATCH calls after a reorder.
**When to use:** Every time a drag-reorder completes (not horizon/category changes, which use the existing PATCH endpoint).
**Example:**
```typescript
// POST /api/goals/reorder
// Body: { items: [{ id: "abc", sortOrder: 0 }, { id: "def", sortOrder: 1 }] }
async reorderGoals(userId: string, items: { id: string; sortOrder: number }[]) {
  await prisma.$transaction(
    items.map(({ id, sortOrder }) =>
      prisma.goal.update({
        where: { id },
        data: { sortOrder },
      })
    )
  );
}
```

### Pattern 5: Tree Sortable with Parent Groups
**What:** In tree view, each node is sortable within its parent group. The `group` for each node is its `parentId` (or a sentinel like `"root"` for top-level YEARLY goals). This allows reordering siblings without accidentally moving across hierarchy levels.
**When to use:** Tree view (DND-01 reorder within same parent).
**Example:**
```typescript
const { ref, isDragging } = useSortable({
  id: goal.id,
  index,
  type: 'tree-node',
  accept: 'tree-node',
  group: goal.parentId ?? 'root',
});
```

### Anti-Patterns to Avoid
- **Multiple DragDropProviders on the same page:** Only one provider should wrap the active view. Nesting providers causes unpredictable behavior.
- **Updating state in onDragOver for non-sortable operations:** The `onDragOver` callback fires frequently during drag. Only use it for optimistic sort reordering (via `move()`). Horizon and category changes should happen in `onDragEnd` after the user commits the drop.
- **Persisting to backend on every onDragOver:** This would flood the API. Persist only on `onDragEnd`, and only if not canceled.
- **Forgetting cancel handling:** When `event.canceled` is true in `onDragEnd`, revert to the snapshot saved in `onDragStart`. The `@dnd-kit` library automatically reverts its internal optimistic updates, but React state must be reverted manually.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reorder array mutation | Manual splice/index math | `move()` from `@dnd-kit/helpers` | Handles flat arrays and grouped objects (Record<string, T[]>). Accounts for edge cases like same-position drops and cross-group moves. |
| Drag overlay positioning | Manual `position: fixed` with mouse tracking | `<DragOverlay>` component | Handles pointer offset, scroll compensation, portal rendering, drop animation. Accessible by default. |
| Collision detection | Custom hit testing | Built-in collision detectors | dnd-kit provides rectangle intersection, closest center, closest corners. Custom detectors only needed for irregular shapes. |
| Keyboard drag support | Custom keydown handlers | Built-in keyboard sensor | dnd-kit's keyboard sensor provides Space to pick up, arrow keys to move, Escape to cancel. ARIA live announcements included. |
| Touch drag activation | Custom touch event handling | Built-in pointer sensor with activation constraints | Pointer sensor handles both mouse and touch. `distance` or `delay` activation prevents accidental drags during scroll. |

**Key insight:** `@dnd-kit/react` 0.3.2 handles almost everything through its hook system. The only custom code needed is: (1) mapping DnD events to your specific data mutations, (2) the batch reorder API endpoint, and (3) the drag overlay visual.

## Common Pitfalls

### Pitfall 1: Accidental Drag on Mobile Scroll
**What goes wrong:** On touch devices, scrolling the goal list triggers drag instead of scroll.
**Why it happens:** The pointer sensor activates immediately on pointerdown by default.
**How to avoid:** Configure the pointer sensor with an activation constraint. Use `distance: 8` (8px movement before activating) or `delay: { value: 200, tolerance: 5 }` (200ms hold before activating).
**Warning signs:** Users on mobile report that they cannot scroll the goal list.

### Pitfall 2: Stale State After Cancel
**What goes wrong:** Drag operation is canceled (Escape key), but the UI shows items in their mid-drag positions.
**Why it happens:** `onDragOver` updated React state optimistically, but `onDragEnd` with `event.canceled` did not revert it.
**How to avoid:** Save a snapshot of the items in `onDragStart` using `useRef`. In `onDragEnd`, if `event.canceled` is true, restore from the snapshot.
**Warning signs:** After pressing Escape during drag, items are in wrong positions.

### Pitfall 3: Hierarchy Validation Rejection
**What goes wrong:** Dragging a goal to a different horizon column fails silently or shows an error, because the goal has a parent that only accepts children of the original horizon.
**Why it happens:** The `validateHierarchy` function enforces strict parent-child horizon rules (YEARLY > QUARTERLY > MONTHLY > WEEKLY). Moving a MONTHLY goal to the WEEKLY column while it still has a QUARTERLY parent triggers validation failure.
**How to avoid:** Before allowing a horizon change drop, check if the goal has a parent. If so, either (a) detach the goal from its parent (`parentId: null`), or (b) show a confirmation dialog explaining the hierarchy impact, or (c) reject the drop and show a toast.
**Warning signs:** API 400 errors after dropping goals between horizon columns.

### Pitfall 4: sortOrder Gaps and Conflicts
**What goes wrong:** After many reorders, `sortOrder` values become fragmented (e.g., 0, 5, 12, 100) or conflicting.
**Why it happens:** Only updating the moved item's `sortOrder` without recalculating siblings. Or using increment-based positioning that drifts over time.
**How to avoid:** On reorder, recalculate `sortOrder` for ALL siblings in the affected group (same parent for tree, same column for board). Send the full set to the batch reorder endpoint.
**Warning signs:** Goals appear in wrong order after page refresh.

### Pitfall 5: List View Table Row DnD Conflicts with TanStack Table
**What goes wrong:** Drag handles interfere with table sorting column click handlers, or row drag breaks table row rendering.
**Why it happens:** TanStack Table manages its own row rendering. Adding DnD refs to table rows requires careful integration to avoid conflicting event handlers.
**How to avoid:** Use a dedicated drag handle column (grip icon) instead of making the entire row draggable. Apply `useSortable` ref to the table row element but use `handleRef` on the grip icon to restrict the drag activation area.
**Warning signs:** Clicking a sortable column header triggers a drag operation instead of sorting.

### Pitfall 6: Tree View DnD Depth Changes
**What goes wrong:** Dragging a tree node to a different depth level (e.g., dropping a MONTHLY goal as a sibling of YEARLY goals) creates an invalid hierarchy state.
**Why it happens:** Tree DnD naturally allows dropping at any level.
**How to avoid:** For Phase 8, restrict tree DnD to reordering within the same parent group only (`group: parentId`). Cross-parent tree moves are complex and should be handled through the edit modal or a separate interaction, not free-form tree drag.
**Warning signs:** Goals appear at wrong hierarchy levels after tree drag.

## Code Examples

Verified patterns from official sources:

### Sortable List Item (for List View rows)
```typescript
// Source: https://dndkit.com/react/hooks/use-sortable
import { useSortable } from '@dnd-kit/react/sortable';

function SortableGoalRow({ goal, index }: { goal: GoalListItem; index: number }) {
  const { ref, handleRef, isDragging } = useSortable({
    id: goal.id,
    index,
    type: 'goal-row',
    accept: 'goal-row',
    data: { goal }, // accessible in event handlers
  });

  return (
    <TableRow ref={ref} className={isDragging ? 'opacity-40' : ''}>
      <TableCell>
        <button ref={handleRef} className="cursor-grab">
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      {/* ... rest of columns */}
    </TableRow>
  );
}
```

### DragOverlay with Source-Based Rendering
```typescript
// Source: https://dndkit.com/react/components/drag-overlay
import { DragOverlay } from '@dnd-kit/react';

<DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
  {(source) => {
    const goal = findGoalById(source.id);
    if (!goal) return null;
    return (
      <div className="rounded-lg border bg-card p-2.5 shadow-lg ring-2 ring-primary/50 rotate-2">
        <span className="text-sm font-medium">{goal.title}</span>
      </div>
    );
  }}
</DragOverlay>
```

### Batch Reorder Mutation Hook
```typescript
// Custom hook for the reorder endpoint
export function useReorderGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      fetchJson('/api/goals/reorder', {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    },
  });
}
```

### Cancel-Safe DragDropProvider
```typescript
// Source: https://dndkit.com/react/guides/multiple-sortable-lists
import { DragDropProvider } from '@dnd-kit/react';
import { move } from '@dnd-kit/helpers';

function DndWrapper({ items, setItems, onCommit, children }) {
  const snapshot = useRef(items);

  return (
    <DragDropProvider
      onDragStart={() => {
        snapshot.current = items;
      }}
      onDragOver={(event) => {
        setItems((prev) => move(prev, event));
      }}
      onDragEnd={(event) => {
        if (event.canceled) {
          setItems(snapshot.current);
          return;
        }
        onCommit(event);
      }}
    >
      {children}
    </DragDropProvider>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@dnd-kit/core` + `@dnd-kit/sortable` (legacy) | `@dnd-kit/react` 0.3.x (new stable API) | 2025 | Simpler hook API (single `ref` instead of `setNodeRef` + `attributes` + `listeners`). `group` prop replaces manual `SortableContext`. `move()` helper replaces manual `arrayMove` with index tracking. |
| `react-beautiful-dnd` | Abandoned (Atlassian) | 2023 | Community fork `@hello-pangea/dnd` exists but is maintenance-only. dnd-kit is the recommended replacement. |
| HTML5 Drag and Drop API | Always avoided for complex UIs | N/A | No touch support, no custom overlays, poor accessibility. Only viable for simple file drop zones. |

**Deprecated/outdated:**
- `@dnd-kit/core` and `@dnd-kit/sortable`: Still published but the docs site now labels them as "legacy" and recommends migration to `@dnd-kit/react`.
- `react-beautiful-dnd`: Abandoned by Atlassian. Does not support React 18+ concurrent features.

## Open Questions

1. **Tree view cross-parent drag**
   - What we know: `useSortable` with `group: parentId` restricts reorder to within the same parent. Cross-parent moves would require detecting a drop on a different parent node and issuing a PATCH with the new `parentId`.
   - What's unclear: Whether the UX should allow free-form tree reparenting via drag (complex hierarchy validation) or restrict tree DnD to sibling reorder only.
   - Recommendation: For v1, restrict tree DnD to sibling reorder within the same parent. Use the edit modal or a dedicated "move" action for reparenting. This avoids the complex hierarchy validation UX problem entirely.

2. **Category DnD mechanism (DND-03)**
   - What we know: The requirement says "move a goal between categories by dragging." This could mean (a) dragging to sidebar category nodes, or (b) a board view grouped by category with column-to-column drag.
   - What's unclear: Which interaction paradigm the user expects.
   - Recommendation: Implement category DnD via the sidebar category tree as drop targets. Each sidebar category node becomes a `useDroppable` target that accepts `goal-card` and `goal-row` types. On drop, PATCH the goal's `categoryId`. This works regardless of which view is active and does not require a separate "category board" view.

3. **Timeline view DnD**
   - What we know: DND-04 says "List, Board, and Tree views" explicitly. Timeline is not mentioned.
   - What's unclear: Whether timeline should also support DnD in Phase 8.
   - Recommendation: Exclude timeline from DnD in this phase. The timeline's horizontal layout with absolute positioning makes it a poor fit for standard sortable DnD. If needed, it can be added later as a separate enhancement.

## Sources

### Primary (HIGH confidence)
- npm `@dnd-kit/react` 0.3.2 page: https://www.npmjs.com/package/@dnd-kit/react (version, API, stable status)
- npm `@dnd-kit/helpers` 0.3.2 page: https://www.npmjs.com/package/@dnd-kit/helpers (move, swap, arrayMove, arraySwap)
- Official docs quickstart: https://dndkit.com/react/quickstart (useDraggable, useDroppable, DragDropProvider)
- Official docs useSortable: https://dndkit.com/react/hooks/use-sortable (full API reference, input/output)
- Official docs DragOverlay: https://dndkit.com/react/components/drag-overlay (render prop, drop animation)
- Official docs multiple sortable lists: https://dndkit.com/react/guides/multiple-sortable-lists (cross-column pattern, cancel handling)
- Official docs migration guide: https://dndkit.com/react/guides/migration (legacy to new API mapping)

### Secondary (MEDIUM confidence)
- Puck blog "Top 5 DnD Libraries for React in 2026": https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react (ecosystem comparison confirming dnd-kit as leader)

### Tertiary (LOW confidence)
- None. All findings verified against official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, verified against npm and official docs
- Architecture: HIGH, patterns directly from official guides (multiple sortable lists guide matches our Board view use case exactly)
- Pitfalls: HIGH/MEDIUM, common patterns from docs plus project-specific hierarchy validation analysis

**Research date:** 2026-03-30
**Valid until:** 2026-05-30 (stable library, 60-day validity)
