# Phase 6: Board and Tree Views — Research

**Researched:** 2026-03-30
**Domain:** React UI view components (kanban board, hierarchical tree)
**Confidence:** HIGH

## Summary

Phase 6 adds two new view modes to the existing goals page: a Board (kanban) view that groups goals as cards into columns, and a Tree view that renders the full yearly to weekly hierarchy as an expandable/collapsible tree. Both views integrate into the existing view switcher, filter bar, and goal detail panel already built in Phases 2 and 3.

The codebase already has most of the infrastructure these views need. The `ViewType` union in the UI store includes `"board"` and `"tree"`, the view switcher component has disabled placeholders for them, the goals page has a `PLACEHOLDER_VIEWS` map ready to be replaced with real rendering, and the `goalService.getTree()` method already fetches 4 levels of nested children for the tree view. No new libraries are needed; both views are pure React component work using existing data hooks, existing UI primitives (Card, Badge, Collapsible), and client side grouping/nesting logic.

**Primary recommendation:** Build both views as standalone components (`GoalBoardView` and `GoalTreeView`) that receive the same `goals` array prop as the existing `GoalListView`, plus a dedicated `useGoalTree` hook for the tree view that calls the existing `goalService.getTree()` through a new API route.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-03 | Board/Kanban view shows goals as cards grouped by status or horizon (user-selectable grouping) | Board view component with grouping toggle, client side array grouping by status or horizon field, reuses existing GoalCard or a slimmed variant, column layout with CSS grid or flexbox |
| VIEW-04 | Tree view shows full goal hierarchy (yearly > quarterly > monthly > weekly) as expandable/collapsible tree | Tree view component using recursive rendering, `goalService.getTree()` already returns 4-level nested data, Collapsible UI primitive already installed, local expand/collapse state |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.4 | Component rendering | Already in project |
| Zustand | 5.0.12 | UI state (view selection, filters) | Already in project, stores activeView and activeFilters |
| @tanstack/react-query | 5.95.2 | Data fetching and caching | Already in project, provides useQuery/useMutation |
| @base-ui/react Collapsible | 1.3.0 | Expand/collapse tree nodes | Already installed; used in sidebar category tree |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.7.0 | Icons for expand/collapse chevrons, grouping toggle | Already in project |
| class-variance-authority | 0.7.1 | Card variant styling | Already in project |
| date-fns | 4.1.0 | Date formatting in cards | Already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom board layout | react-kanban, @hello-pangea/dnd | Overkill for read-only board without drag and drop; Phase 8 adds DnD separately |
| Custom tree component | react-arborist, react-complex-tree | Adds dependency for what is a simple 4-level recursive render; drag and drop in tree is Phase 8 |

**Installation:**
```bash
# No new packages needed. All required libraries are already installed.
```

## Architecture Patterns

### Recommended Project Structure

```
components/
├── goals/
│   ├── goal-board-view.tsx       # Board/kanban view component
│   ├── goal-board-column.tsx     # Single column in the board
│   ├── goal-board-card.tsx       # Card within a board column (compact variant)
│   ├── goal-tree-view.tsx        # Tree view component
│   └── goal-tree-node.tsx        # Recursive tree node with expand/collapse
lib/
├── hooks/
│   └── use-goals.ts              # Add useGoalTree hook here
app/
├── api/
│   └── goals/
│       └── tree/
│           └── route.ts          # New API route for goalService.getTree()
```

### Pattern 1: Client Side Grouping for Board View

**What:** Group the flat `goals[]` array by a selected field (status or horizon) on the client side, rather than making separate API calls per column.

**When to use:** When the data is already fetched and the grouping dimension is user-toggleable. The existing `useGoals(filters)` hook already returns all goals matching current filters; grouping is a presentation concern.

**Example:**
```typescript
type BoardGrouping = "status" | "horizon";

const STATUS_COLUMNS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"];
const HORIZON_COLUMNS = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"];

function groupGoals(goals: GoalListItem[], groupBy: BoardGrouping) {
  const columns = groupBy === "status" ? STATUS_COLUMNS : HORIZON_COLUMNS;
  const grouped = new Map<string, GoalListItem[]>();
  for (const col of columns) {
    grouped.set(col, []);
  }
  for (const goal of goals) {
    const key = goal[groupBy];
    const arr = grouped.get(key);
    if (arr) arr.push(goal);
  }
  return grouped;
}
```

### Pattern 2: Recursive Tree Node Rendering

**What:** A `GoalTreeNode` component that renders itself and maps over `children` to render child nodes, with collapsible state per node.

**When to use:** When rendering hierarchical data with a fixed depth (4 levels: yearly, quarterly, monthly, weekly). The existing `goalService.getTree()` returns exactly this structure.

**Example:**
```typescript
interface TreeGoal {
  id: string;
  title: string;
  status: string;
  horizon: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  progress: number;
  category: { name: string; color: string; icon: string | null } | null;
  children: TreeGoal[];
}

function GoalTreeNode({ goal, depth }: { goal: TreeGoal; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2); // auto-expand top 2 levels

  return (
    <div style={{ paddingLeft: `${depth * 1.5}rem` }}>
      <button onClick={() => setExpanded(!expanded)}>
        {goal.children.length > 0 && <ChevronIcon rotated={expanded} />}
        <span>{goal.title}</span>
      </button>
      {expanded && goal.children.map(child => (
        <GoalTreeNode key={child.id} goal={child} depth={depth + 1} />
      ))}
    </div>
  );
}
```

### Pattern 3: Separate Data Hook for Tree View

**What:** The tree view needs hierarchical (nested) data, while the existing `useGoals()` hook returns a flat list. Create a dedicated `useGoalTree()` hook that calls a new `/api/goals/tree` endpoint backed by the existing `goalService.getTree()`.

**When to use:** When the view is active (`activeView === "tree"`). The hook should be enabled conditionally to avoid unnecessary API calls when other views are active.

**Example:**
```typescript
export function useGoalTree() {
  return useQuery({
    queryKey: queryKeys.goals.tree(),
    queryFn: () => fetchJson<TreeGoal[]>("/api/goals/tree"),
  });
}
```

### Pattern 4: Board Grouping State in UI Store

**What:** Add a `boardGroupBy` field to the UI store to persist whether the user groups by status or horizon. This follows the same persistence pattern used for `activeView`, `activeFilters`, and `activeSorting`.

**When to use:** So the user's grouping preference survives page navigation and browser refreshes.

**Example:**
```typescript
// In ui-store.ts
boardGroupBy: "status" | "horizon";
setBoardGroupBy: (groupBy: "status" | "horizon") => void;
```

### Anti-Patterns to Avoid

- **Separate API calls per board column:** Do not fetch goals per status or per horizon. The flat list is already available; group client side.
- **Global expand/collapse state in Zustand:** Tree node expand/collapse is ephemeral UI state. Keep it in local React state within each `GoalTreeNode` component, not in the persisted store.
- **Rendering all tree levels unconditionally:** Always guard children rendering behind the `expanded` state to keep the DOM small for large goal sets.
- **Duplicating GoalCard entirely:** The board card should be a compact variant or a new slim component, not a copy-paste of the full GoalCard with modifications scattered throughout.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expand/collapse animation | Custom CSS transitions for tree nodes | @base-ui/react Collapsible | Already in project, handles height animation, accessibility attributes |
| Tooltip for grouping toggle | Custom hover state | @base-ui/react Tooltip | Already used in view switcher, consistent UX |
| Responsive column layout | Custom resize observers for board columns | CSS grid with auto-fit/minmax | Pure CSS solution, responsive without JS |

**Key insight:** Both views are purely presentational. They receive existing data, apply client side transformations (grouping or nesting), and render with existing UI primitives. No external visualization libraries are needed.

## Common Pitfalls

### Pitfall 1: Tree View Loading Different Data Than Other Views

**What goes wrong:** The tree view shows all goals in a hierarchy while other views show filtered goals. If the user has active filters (e.g., only "Health" category), switching to tree view should either respect those filters or clearly indicate it shows all goals.

**Why it happens:** `goalService.getTree()` fetches all yearly goals unconditionally. It does not accept filter parameters.

**How to avoid:** Apply filters client side to the tree data, or clearly label the tree view as "Full Hierarchy" that ignores filters. The recommended approach: filter the tree client side by pruning nodes that do not match active filters (keeping ancestor nodes that have matching descendants).

**Warning signs:** User applies a category filter, switches to tree view, and sees goals from all categories.

### Pitfall 2: Board Columns Rendering Empty When Horizon Filter Is Active

**What goes wrong:** If the user is filtering by a specific horizon (e.g., "Weekly") and groups by horizon, only one column has content and the board looks broken.

**Why it happens:** Grouping by the same dimension as the active filter produces a single-column board.

**How to avoid:** When grouping by horizon and a horizon filter is active, either auto-switch grouping to status or display a hint suggesting the user change grouping.

**Warning signs:** Board view shows three empty columns and one populated column.

### Pitfall 3: Deep Tree Re-renders on Goal Update

**What goes wrong:** Updating a single goal causes the entire tree to re-render because the tree data is a single deeply nested object.

**Why it happens:** React re-renders when the top-level query data reference changes, and the tree is a single nested structure.

**How to avoid:** Each `GoalTreeNode` should receive its data as a prop and use `React.memo()` to skip re-renders when its specific goal data has not changed. Query invalidation after mutations already works via `queryKeys.goals.all()` invalidation.

**Warning signs:** Noticeable lag when completing or editing a goal while the tree view is displayed.

### Pitfall 4: Forgetting to Wire Up Goal Selection in New Views

**What goes wrong:** Clicking a goal in the board or tree view does not open the detail panel on the right side.

**Why it happens:** The detail panel relies on `useUIStore.selectGoal(id)` being called on click. New view components must integrate this callback.

**How to avoid:** Both board card and tree node click handlers must call `selectGoal(goal.id)`. Follow the same pattern as `GoalCard` and `GoalListView`.

**Warning signs:** Goals are visible but clicking them does nothing.

## Code Examples

### Board View Integration Point (goals page)

The current goals page has this placeholder logic:

```typescript
// In app/(app)/goals/page.tsx, renderContent()
const placeholder = PLACEHOLDER_VIEWS[activeView];
if (placeholder) {
  const Icon = placeholder.icon;
  return (
    <div className="flex flex-col items-center justify-center py-16 ...">
      <Icon className="size-12 ..." />
      <p className="...">{placeholder.label}</p>
    </div>
  );
}
```

Replace board and tree entries from `PLACEHOLDER_VIEWS` and add rendering cases:

```typescript
if (activeView === "board") {
  return <GoalBoardView goals={goalList} />;
}
if (activeView === "tree") {
  return <GoalTreeView />;  // Fetches own data via useGoalTree
}
```

### View Switcher Update

Enable board and tree in the view switcher:

```typescript
// In goal-view-switcher.tsx VIEW_OPTIONS
{ value: "board", label: "Board", icon: Columns3, enabled: true },
{ value: "tree", label: "Tree", icon: GitBranch, enabled: true },
```

### API Route for Tree

```typescript
// app/api/goals/tree/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();
  try {
    const tree = await goalService.getTree(auth.userId);
    return NextResponse.json(tree);
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Board Grouping Toggle Component

```typescript
function BoardGroupingToggle({
  groupBy,
  onChange,
}: {
  groupBy: "status" | "horizon";
  onChange: (g: "status" | "horizon") => void;
}) {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <span>Group by:</span>
      <button
        onClick={() => onChange("status")}
        className={cn("px-2 py-0.5 rounded", groupBy === "status" && "bg-muted font-medium text-foreground")}
      >
        Status
      </button>
      <button
        onClick={() => onChange("horizon")}
        className={cn("px-2 py-0.5 rounded", groupBy === "horizon" && "bg-muted font-medium text-foreground")}
      >
        Horizon
      </button>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drag-and-drop kanban libraries (react-beautiful-dnd) | Standalone read-only board; DnD added separately (Phase 8 with @dnd-kit/react) | 2024+ | Simpler initial implementation; DnD layered on later |
| Fully controlled tree state (Redux) | Local component state for expand/collapse | React 18+ with hooks | Less boilerplate, no global state pollution |
| Virtualized trees (react-window) | Direct rendering with memo | For < 500 nodes | Virtualization unnecessary at expected scale (< 200 goals) |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Unmaintained since 2022; project uses @dnd-kit/react for Phase 8. Not relevant for Phase 6 since there is no drag and drop yet.

## Open Questions

1. **Tree filtering behavior**
   - What we know: Other views (cards, list, board) respect `activeFilters`. Tree view fetches all goals regardless.
   - What's unclear: Should the tree apply filters by pruning non-matching branches, or show full hierarchy always?
   - Recommendation: Apply filters client side. Keep ancestor nodes if any descendant matches. This maintains context while respecting the user's filter intent. If performance becomes an issue with many goals, consider server side filtered tree query.

2. **Board view and goal detail panel interaction**
   - What we know: The detail panel is a fixed-width right side panel. Cards, list, and tree views use the same two-panel layout.
   - What's unclear: Should board columns scroll independently or should the entire page scroll?
   - Recommendation: Entire page scrolls vertically. Columns flow naturally. Horizontal scrolling for columns is only needed if there are many columns (4 statuses or 4 horizons fit in most viewports without horizontal scroll).

## Sources

### Primary (HIGH confidence)

- **Project codebase** (local disk): UI store (`lib/stores/ui-store.ts`), view switcher (`components/goals/goal-view-switcher.tsx`), goals page (`app/(app)/goals/page.tsx`), goal service (`lib/services/goal-service.ts`), tree queries (`lib/tree-queries.ts`), query keys (`lib/queries/keys.ts`). All read directly from `/Users/Shared/Domain/Code/Personal/goals/`.
- **Prisma schema** (`prisma/schema.prisma`): Goal model with adjacency list hierarchy (parentId self-reference, children relation).
- **@base-ui/react Collapsible**: Already installed and used in sidebar category tree component.

### Secondary (MEDIUM confidence)

- **React.memo() for tree performance**: Standard React optimization pattern for preventing unnecessary re-renders in recursive components. Well-documented in React docs.

### Tertiary (LOW confidence)

- None. All findings are based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all libraries already installed, no new dependencies
- Architecture: HIGH, patterns directly derived from existing codebase conventions (view switcher, goal list view, goal card, collapsible sidebar)
- Pitfalls: HIGH, identified from direct code analysis of filter/view interaction patterns

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable; no external library dependencies to track)
