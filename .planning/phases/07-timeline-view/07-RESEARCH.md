# Phase 7: Timeline View REDESIGN - Research

**Researched:** 8. 4. 2026
**Domain:** Gantt-style timeline redesign (tree hierarchy, CSS Grid, React)
**Confidence:** HIGH

## Summary

The existing timeline view works but has fundamental UX problems that make it ineffective as a planning tool. The current design groups goals into four horizon-based swim lanes (Yearly, Quarterly, Monthly, Weekly), which fragments the parent-child relationship and makes hierarchy invisible. Each goal bar has a Collapsible toggle that expands a popup showing priority and a "View details" link, but this adds two clicks to do what should be one click. Weekly goals render as tiny pills that are unreadable. The overall layout wastes vertical space on four swim lanes that are often mostly empty.

The redesign replaces this with a proper gantt-style chart where the LEFT side shows an indented tree of goals (parent > children, like the existing Tree View) and the RIGHT side shows horizontal bars for each goal spanning their time range on a shared time axis. This is the standard gantt chart pattern used by every professional planning tool. The key insight is that the timeline should display the TREE structure (which the app already has via `useGoalTree()`), not a flat grouping by horizon. Clicking any goal bar or its tree row should call `selectGoal(id)` to open the detail panel on the right, which is exactly how the list, tree, and board views already work. No custom popups, no expand toggles on bars.

No new dependencies are needed. The existing stack (CSS Grid for layout, date-fns for date math, Zustand for zoom/year state, React Query via `useGoalTree()` for data) remains correct. The `timeline-utils.ts` module is mostly reusable with minor modifications. The main change is structural: replacing the four-swim-lane architecture with a two-panel (tree + bars) layout where each row in the tree panel corresponds to a row in the bar panel.

**Primary recommendation:** Replace the swim-lane timeline with a split-panel gantt: a fixed-width left panel showing an indented, collapsible tree of goal names, and a scrollable right panel showing horizontal bars on a CSS Grid time axis. One click on any bar or row opens the detail panel via `selectGoal()`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-05 | Timeline view shows a horizontal year line with quarter markers, expandable to months and weeks | CSS Grid time axis with configurable zoom levels (Year = 4 quarter columns, Quarter = 12 month columns, Month = weekly columns for a single month). Zoom controls and year/month navigation already exist in the store and UI. |
| VIEW-06 | Timeline goals appear as interactive nodes on the line at their horizon level | Goals render as labeled horizontal bars spanning their date range. Each bar is clickable, calling `selectGoal(id)` to open the detail panel. The "horizon level" is now expressed through tree indentation (parent > child) rather than swim lanes. |
| VIEW-07 | Clicking a goal node on the timeline expands details inline (children, progress, notes) | **Reinterpreted for the redesign:** clicking a bar/row opens the existing GoalDetail side panel (same as every other view). Children are VISIBLE in the tree structure by default (expand/collapse on the tree, not on the bar). Progress is shown as a fill percentage on the bar itself. No separate inline popup needed. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | Component rendering | Already in project |
| CSS Grid | Native | Time axis layout with grid-column placement for bars | Same technique as current implementation; well-established pattern for gantt charts |
| date-fns | 4.1.0 | Date calculations (quarter boundaries, month ranges, week numbers) | Already in project; `getTimeSegments()` and `getGoalColumns()` in `timeline-utils.ts` already do this |
| Zustand | 5.0.12 | Timeline zoom, year, and month state persistence | Already in project; `timelineZoom`, `timelineYear`, `timelineMonth` already in ui-store |
| @tanstack/react-query | 5.x | Data fetching via `useGoalTree()` hook | Already in project; provides hierarchical data the redesigned timeline needs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.x | Icons for zoom controls, expand/collapse chevrons, status indicators | Already in project |
| clsx + tailwind-merge (cn) | Installed | Conditional class composition | Already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS Grid gantt | Syncfusion/SVAR/Bryntum Gantt library | 200KB+ bundle, commercial license, designed for PM (dependencies, resources), overkill for a personal goal tree. The redesign is still a relatively simple layout problem. |
| Split-panel tree+bars layout | Keep swim lanes but improve them | Swim lanes fundamentally hide hierarchy. The user explicitly wants parent-child nesting visible, which requires tree rows. |
| CSS Grid bars | SVG bars | SVG adds coordinate math, viewBox complexity, text wrapping issues. CSS Grid handles all this natively. |

**Installation:**
```bash
# No new packages needed. All required libraries are already installed.
```

## Architecture Patterns

### Recommended Project Structure

```
components/
  goals/
    goal-timeline-view.tsx       # REWRITE: Split-panel container (tree panel + bars panel)
    goal-timeline-node.tsx       # REWRITE: Single row component (tree label + bar)
lib/
  timeline-utils.ts              # MODIFY: Keep getTimeSegments, getGoalColumns. Remove flattenByHorizon (no longer needed). Add flattenTree helper.
  stores/
    ui-store.ts                  # NO CHANGE: timelineZoom, timelineYear, timelineMonth already exist
  hooks/
    use-goals.ts                 # NO CHANGE: useGoalTree() already provides the data
  tree-filter.ts                 # NO CHANGE: filterTree() already works for tree data
```

### Pattern 1: Split-Panel Gantt Layout

**What:** A two-panel layout where the left panel shows an indented tree of goal titles (fixed width, scrolls vertically) and the right panel shows horizontal bars on a CSS Grid time axis (scrolls both horizontally and vertically). Both panels share the same vertical scroll position so tree rows and bars stay aligned.

**When to use:** This is the standard gantt chart layout. Every major gantt tool (MS Project, Gantt by Teamwork, Monday.com) uses this pattern.

**Example:**
```typescript
// Outer container: flex row
<div className="flex rounded-lg border overflow-hidden">
  {/* Left panel: tree labels */}
  <div
    ref={treePanelRef}
    className="w-[240px] shrink-0 border-r overflow-y-auto overflow-x-hidden"
    onScroll={syncScroll}
  >
    {/* Header */}
    <div className="sticky top-0 z-10 bg-muted/80 border-b px-3 py-2 text-xs font-semibold">
      Goals
    </div>
    {/* Tree rows */}
    {flatRows.map((row) => (
      <TreeRow key={row.goal.id} row={row} onSelect={selectGoal} />
    ))}
  </div>

  {/* Right panel: bars on time grid */}
  <div
    ref={barsPanelRef}
    className="flex-1 overflow-auto"
    onScroll={syncScroll}
  >
    {/* Time axis header (sticky top) */}
    <div className="sticky top-0 z-10 ...">
      {segments.map(...)}
    </div>
    {/* Bar rows, one per flatRow */}
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${segments.length}, minmax(${minColWidth}, 1fr))`,
    }}>
      {flatRows.map((row) => (
        <BarRow key={row.goal.id} row={row} segments={segments} />
      ))}
    </div>
  </div>
</div>
```

**Critical detail: Synchronized vertical scrolling.** Both panels must scroll vertically in sync. Use a shared `onScroll` handler that sets `scrollTop` on the sibling panel. Alternatively, use a single vertical scroll container that wraps both panels, with only the bars panel having horizontal scroll.

**Recommended approach:** A single outer div with `overflow-y: auto` and a flex layout inside. The left panel has `overflow-y: hidden` (no independent vertical scroll). The right panel has `overflow-x: auto` (horizontal scroll for month zoom). Vertical scrolling is handled by the outer container, so both panels always stay in sync without JavaScript scroll synchronization.

```typescript
// Better approach: single vertical scroll, only right panel scrolls horizontally
<div className="flex rounded-lg border overflow-hidden" style={{ maxHeight: "calc(100vh - 220px)" }}>
  <div className="flex flex-1 overflow-y-auto">
    {/* Left panel: fixed width, no independent scroll */}
    <div className="w-[240px] shrink-0 border-r">
      <div className="sticky top-0 z-10 ...">Goals</div>
      {flatRows.map(row => <TreeRow ... />)}
    </div>
    {/* Right panel: horizontal scroll when needed */}
    <div className="flex-1 overflow-x-auto">
      <div className="sticky top-0 z-10 ...">
        {/* Time axis header */}
      </div>
      <div style={{ display: "grid", ... }}>
        {flatRows.map(row => <BarRow ... />)}
      </div>
    </div>
  </div>
</div>
```

Wait, this does not work cleanly because the right panel needs independent horizontal scrolling while sharing vertical scrolling. The correct pattern is:

```
Outer wrapper (overflow-y: auto, fixed height)
  Left panel (sticky left: 0, z-index for overlay)
  Right panel (overflow-x: auto)
```

Actually, the simplest correct pattern: make the entire container scrollable in both directions (`overflow: auto`), with the left panel using `position: sticky; left: 0` so it stays fixed during horizontal scroll. This is exactly how the current timeline already handles the lane labels (they use `sticky left-0 z-20`).

```typescript
<div ref={scrollRef} className="overflow-auto rounded-lg border"
     style={{ maxHeight: "calc(100vh - 220px)" }}>
  {/* Single grid for the whole gantt */}
  <div style={{
    display: "grid",
    gridTemplateColumns: `240px repeat(${segments.length}, minmax(${minColWidth}, 1fr))`,
  }}>
    {/* Row 0: Header */}
    <div className="sticky left-0 top-0 z-30 bg-muted/80 border-b border-r ...">Goals</div>
    {segments.map(seg => (
      <div className="sticky top-0 z-20 border-b ...">{seg.label}</div>
    ))}
    {/* Row N: Each goal */}
    {flatRows.map(row => (
      <React.Fragment key={row.goal.id}>
        <div className="sticky left-0 z-10 border-r ..."
             style={{ paddingLeft: `${row.depth * 1.25 + 0.5}rem` }}>
          {/* Tree label with indent */}
        </div>
        <div style={{ gridColumn: `2 / ${segments.length + 2}` }}>
          {/* Bar positioned within a sub-grid */}
        </div>
      </React.Fragment>
    ))}
  </div>
</div>
```

This is the cleanest approach: a single CSS Grid, single scroll container, tree labels are `sticky left-0`, time headers are `sticky top-0`, the corner cell is `sticky` on both axes. This is exactly how the current implementation handles lane labels, just applied to every row instead of four swim lanes.

### Pattern 2: Flattened Tree with Depth for Row Rendering

**What:** The `useGoalTree()` hook returns a nested tree. For the gantt layout, flatten this tree into an ordered array where each entry includes the goal and its depth. Children of collapsed parents are excluded from the array.

**When to use:** When rendering a tree as sequential rows (gantt, tree table, outline view).

**Example:**
```typescript
// timeline-utils.ts
export interface FlatTimelineRow {
  goal: TreeGoal;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

export function flattenTree(
  goals: TreeGoal[],
  expandedIds: Set<string>,
  depth: number = 0,
): FlatTimelineRow[] {
  const rows: FlatTimelineRow[] = [];
  for (const goal of goals) {
    const hasChildren = goal.children.length > 0;
    const isExpanded = expandedIds.has(goal.id);
    rows.push({ goal, depth, hasChildren, isExpanded });
    if (hasChildren && isExpanded) {
      rows.push(...flattenTree(goal.children, expandedIds, depth + 1));
    }
  }
  return rows;
}
```

### Pattern 3: Bar Rendering Within a Sub-Grid Row

**What:** Each goal's bar area spans all time columns (gridColumn: `2 / -1`). Inside this area, a nested div with the same column template positions the actual bar using `getGoalColumns()`.

**When to use:** When each row needs its own bar positioned independently on the same time axis.

**Example:**
```typescript
function BarRow({ row, segments, year, minColWidth, onSelect }: BarRowProps) {
  const cols = getGoalColumns(row.goal, segments, year);
  if (!cols) return <div className="h-8 border-b" style={{ gridColumn: "2 / -1" }} />;

  return (
    <div
      className="relative h-8 border-b"
      style={{
        gridColumn: `2 / ${segments.length + 2}`,
        display: "grid",
        gridTemplateColumns: `repeat(${segments.length}, minmax(${minColWidth}, 1fr))`,
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(row.goal.id)}
        className="rounded h-6 my-1 px-2 text-xs font-medium truncate text-left transition-colors hover:brightness-110"
        style={{
          gridColumn: `${cols.start} / ${cols.end}`,
          backgroundColor: `${row.goal.category?.color ?? "#6B7280"}25`,
          borderLeft: `3px solid ${row.goal.category?.color ?? "#6B7280"}`,
        }}
      >
        {row.goal.title}
        {/* Progress fill overlay */}
        {row.goal.progress > 0 && (
          <div
            className="absolute inset-y-1 left-0 rounded opacity-20"
            style={{
              width: `${Math.min(row.goal.progress, 100)}%`,
              backgroundColor: row.goal.category?.color ?? "#6B7280",
            }}
          />
        )}
      </button>
    </div>
  );
}
```

### Pattern 4: Expand/Collapse State in Component (Not Zustand)

**What:** The set of expanded goal IDs is managed in local React state (`useState<Set<string>>`) inside the GoalTimelineView component, NOT in Zustand. Default to expanding the first two levels (depth < 2), matching the tree view behavior.

**When to use:** Expand/collapse state is view-specific and transient. It does not need to persist across sessions. Putting it in Zustand would add migration complexity and is not worth persisting.

**Example:**
```typescript
const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
  // Auto-expand first two levels on initial render
  const ids = new Set<string>();
  for (const goal of tree ?? []) {
    ids.add(goal.id);
    for (const child of goal.children) {
      ids.add(child.id);
    }
  }
  return ids;
});

function toggleExpand(goalId: string) {
  setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(goalId)) {
      next.delete(goalId);
    } else {
      next.add(goalId);
    }
    return next;
  });
}
```

### Anti-Patterns to Avoid

- **Keeping the horizon swim lanes.** The user explicitly called out that grouping by horizon creates visual noise and hides hierarchy. The redesign must show tree structure, not horizon buckets.
- **Adding a Collapsible popup on each bar.** The current expand toggle shows priority and a "View details" link, adding two clicks to reach the detail panel. Replace with a single click on the bar that calls `selectGoal(id)`. The detail panel already shows everything the popup showed and more.
- **Using `useGoals()` (flat list) for the timeline.** The flat list has no hierarchy. The redesigned timeline MUST use `useGoalTree()` to get nested parent-child data, then flatten it for row rendering.
- **Rendering weekly goals as pills/dots.** Every goal, regardless of horizon, gets a full-width bar with a readable title label. Weekly goals that span a small time range get a minimum bar width so their title is at least partially visible.
- **Synchronized scroll via JavaScript event handlers.** Use a single scroll container with CSS `sticky` positioning instead. JavaScript scroll sync is laggy, causes jank, and is a maintenance burden.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date interval generation | Manual quarter/month/week loops | `date-fns` interval functions (already in `timeline-utils.ts`) | Edge cases with year boundaries, leap years, week numbering |
| Tree flattening with depth | Ad hoc recursion in the component | `flattenTree()` utility function in `timeline-utils.ts` | Reusable, testable, keeps component clean |
| Tree filtering | Custom filter in timeline component | `filterTree()` from `lib/tree-filter.ts` (already shared) | Already used by TreeView; handles ancestor preservation |
| Scroll synchronization | JavaScript `onScroll` event pairing | Single scroll container + CSS `position: sticky` | No jank, no race conditions, browser-native performance |
| Goal detail expansion | Custom popup/collapsible on each bar | `selectGoal(id)` opening the existing GoalDetail side panel | Consistent with every other view; already built and tested |
| Minimum bar width for readability | Fixed pixel widths | CSS `min-width` on bar elements | Responsive, adapts to zoom level |

**Key insight:** The hardest part of the redesign is NOT the CSS Grid layout or the date math (both already work in the current implementation). The hardest part is restructuring the component from "flat goals in swim lanes" to "tree rows with bars." The `flattenTree()` helper and the single-grid-with-sticky-columns pattern make this straightforward.

## Common Pitfalls

### Pitfall 1: Tree Row Heights Not Matching Between Panels

**What goes wrong:** In a split-panel layout, tree labels and bars can desync vertically if they have different content heights.

**Why it happens:** Text wrapping, different padding, or conditional content in one panel but not the other.

**How to avoid:** Use a single CSS Grid for the entire gantt (not two separate panels). Each goal is a grid row spanning both the tree label column and the bar columns. This guarantees row height alignment automatically. The current implementation already uses this approach for swim lanes; the redesign applies it to every goal row.

**Warning signs:** Bars appearing next to the wrong goal name.

### Pitfall 2: Goals Without Dates Still Need Bars

**What goes wrong:** Goals without `startDate` or `deadline` disappear from the timeline.

**Why it happens:** `getGoalColumns()` returns null or a zero-width span for date-less goals.

**How to avoid:** The existing `getHorizonFallback()` function in `timeline-utils.ts` already handles this by assigning fallback positions based on horizon. Keep this logic. Add a visual distinction: date-less goals get a lighter opacity or dashed border on their bar, matching the current implementation's dashed border for fallback-positioned goals.

**Warning signs:** Empty tree rows with no corresponding bar.

### Pitfall 3: Expand/Collapse Desync with Filter Changes

**What goes wrong:** User expands/collapses some nodes, then changes a filter. The expanded state references goal IDs that are no longer in the filtered tree.

**Why it happens:** The expanded ID set is independent of the filtered data.

**How to avoid:** This is actually fine. `flattenTree()` only recurses into children that exist in the filtered tree. If a goal is filtered out, its children are also filtered out, and the expanded ID just sits unused in the set. No special handling needed. The tree view already has this exact behavior.

**Warning signs:** None; this is a non-issue.

### Pitfall 4: Today Marker Position Calculation

**What goes wrong:** The today marker appears at the wrong horizontal position or disappears at certain zoom levels.

**Why it happens:** The current implementation uses a percentage-based `calc()` formula that assumes the label column is exactly 8rem. If the tree panel width changes, the formula breaks.

**How to avoid:** With the single-grid approach, the today marker should be positioned using the same CSS Grid column system as the bars. Find which time segment contains today, then position the marker within that segment using a fractional offset. This is more robust than a percentage-of-total-width calculation.

**Warning signs:** Today line appears between columns rather than at the correct date position.

### Pitfall 5: Horizontal Scroll Hiding the Tree Panel

**What goes wrong:** On month zoom (many columns), horizontal scrolling pushes the tree labels off-screen.

**Why it happens:** Standard overflow scrolling moves all content.

**How to avoid:** The tree label column uses `position: sticky; left: 0` with a `z-index` high enough to overlay the bars. This is the same technique the current implementation uses for lane labels. The header row uses `position: sticky; top: 0`. The corner cell (top-left) uses both `sticky` axes.

**Warning signs:** Tree labels scrolling away when the user scrolls right.

### Pitfall 6: Store Migration Not Needed

**What goes wrong:** Developer adds new fields to ui-store for the redesign and bumps the persist version unnecessarily.

**Why it happens:** Instinct from the original Phase 7 implementation which added `timelineZoom`, `timelineYear`, `timelineMonth`.

**How to avoid:** The redesign reuses the EXISTING store fields. `timelineZoom`, `timelineYear`, and `timelineMonth` are already in the store at version 5. No new persisted fields are needed. Expand/collapse state is local component state. **Do not bump the store version.**

**Warning signs:** Unnecessary migration code.

## Code Examples

### Existing Code to Keep (From timeline-utils.ts)

The following functions are correct and should be kept as-is:

- `getTimeSegments(year, zoom, month)` - generates time segments for grid columns
- `getGoalColumns(goal, segments, year)` - calculates grid column span for a goal
- `getHorizonFallback(horizon, segments)` - fallback positioning for date-less goals
- `TimelineZoom`, `TimeSegment`, `TimelineGoal` types

### Existing Code to Remove

- `flattenByHorizon()` - no longer needed (was for swim-lane grouping)
- The `TimelineGoal` interface can be simplified or replaced by `FlatTimelineRow`

### New Helper: flattenTree

```typescript
// Add to timeline-utils.ts

export interface FlatTimelineRow {
  goal: TreeGoal;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/**
 * Flatten a hierarchical goal tree into ordered rows for gantt rendering.
 * Only includes children of expanded nodes.
 */
export function flattenTree(
  goals: TreeGoal[],
  expandedIds: Set<string>,
  depth: number = 0,
): FlatTimelineRow[] {
  const rows: FlatTimelineRow[] = [];
  for (const goal of goals) {
    const hasChildren = goal.children.length > 0;
    const isExpanded = expandedIds.has(goal.id);
    rows.push({ goal, depth, hasChildren, isExpanded });
    if (hasChildren && isExpanded) {
      rows.push(...flattenTree(goal.children, expandedIds, depth + 1));
    }
  }
  return rows;
}
```

### GoalTimelineView Skeleton (Redesigned)

```typescript
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useGoalTree } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import { getTimeSegments, getGoalColumns, flattenTree } from "@/lib/timeline-utils";
import { filterTree } from "@/lib/tree-filter";
import { differenceInDays } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown, GanttChart, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function GoalTimelineView() {
  const { data: tree, isLoading } = useGoalTree();
  const timelineZoom = useUIStore((s) => s.timelineZoom);
  const setTimelineZoom = useUIStore((s) => s.setTimelineZoom);
  const timelineYear = useUIStore((s) => s.timelineYear);
  const setTimelineYear = useUIStore((s) => s.setTimelineYear);
  const timelineMonth = useUIStore((s) => s.timelineMonth);
  const setTimelineMonth = useUIStore((s) => s.setTimelineMonth);
  const activeFilters = useUIStore((s) => s.activeFilters);
  const selectGoal = useUIStore((s) => s.selectGoal);
  const selectedGoalId = useUIStore((s) => s.selectedGoalId);

  const filteredTree = filterTree(tree ?? [], activeFilters);
  const segments = getTimeSegments(timelineYear, timelineZoom, timelineMonth);

  // Expand/collapse: default first two levels open
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const g of tree ?? []) {
      ids.add(g.id);
      for (const c of g.children) ids.add(c.id);
    }
    return ids;
  });

  const flatRows = useMemo(
    () => flattenTree(filteredTree, expandedIds),
    [filteredTree, expandedIds],
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ... zoom controls, today marker, grid rendering
  // Single CSS Grid: column 1 = tree labels (sticky left), columns 2+ = time axis
  // Each flatRow = one grid row
}
```

### GoalTimelineNode Skeleton (Redesigned)

The GoalTimelineNode becomes a single-row component with TWO cell renders:

```typescript
// Renders inside a React.Fragment within the parent grid

// Cell 1: Tree label (sticky left)
<div
  className="sticky left-0 z-10 bg-background border-b border-r flex items-center gap-1.5 px-2 py-1 text-sm cursor-pointer hover:bg-muted/60"
  style={{ paddingLeft: `${row.depth * 1.25 + 0.75}rem` }}
  onClick={() => selectGoal(row.goal.id)}
>
  {/* Expand/collapse chevron */}
  {row.hasChildren ? (
    <button onClick={(e) => { e.stopPropagation(); toggleExpand(row.goal.id); }}>
      <ChevronRight className={cn("size-3.5", row.isExpanded && "rotate-90")} />
    </button>
  ) : <span className="size-3.5" />}
  {/* Category dot */}
  {row.goal.category && (
    <span className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: row.goal.category.color }} />
  )}
  {/* Title */}
  <span className="truncate text-sm font-medium">{row.goal.title}</span>
</div>

// Cell 2: Bar area (spans all time columns)
<div
  className="border-b relative"
  style={{
    gridColumn: `2 / ${segments.length + 2}`,
    display: "grid",
    gridTemplateColumns: `repeat(${segments.length}, minmax(${minColWidth}, 1fr))`,
  }}
>
  {cols && (
    <button
      type="button"
      className="h-6 my-1 rounded px-1.5 text-[11px] font-medium truncate text-left"
      style={{
        gridColumn: `${cols.start} / ${cols.end}`,
        backgroundColor: `${categoryColor}20`,
        borderLeft: `3px solid ${categoryColor}`,
        minWidth: "2rem",
      }}
      onClick={() => selectGoal(row.goal.id)}
    >
      {row.goal.title}
    </button>
  )}
</div>
```

### Today Marker (Improved)

```typescript
function TodayMarker({ timelineYear, segments }: { timelineYear: number; segments: TimeSegment[] }) {
  const now = new Date();
  if (now.getFullYear() !== timelineYear) return null;

  const segIndex = segments.findIndex((s) => now >= s.start && now <= s.end);
  if (segIndex < 0) return null;

  const seg = segments[segIndex];
  const totalDays = differenceInDays(seg.end, seg.start) || 1;
  const dayOffset = differenceInDays(now, seg.start);
  const fraction = dayOffset / totalDays;

  // Position: offset within the label column width + segment columns
  // Using the same percentage approach as current implementation
  const yearStart = new Date(timelineYear, 0, 1);
  const yearEnd = new Date(timelineYear, 11, 31);
  const totalYearDays = differenceInDays(yearEnd, yearStart) || 365;
  const daysElapsed = differenceInDays(now, yearStart);
  const todayPercent = Math.max(0, Math.min(100, (daysElapsed / totalYearDays) * 100));

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-30 pointer-events-none"
      style={{ left: `calc(240px + (100% - 240px) * ${todayPercent / 100})` }}
    />
  );
}
```

Note: the label column width changes from `8rem` (128px) to `240px` in the redesign since the tree panel needs more space for indented labels.

## State of the Art

| Old Approach (Current) | New Approach (Redesign) | Why Change |
|------------------------|------------------------|------------|
| 4 horizon swim lanes | Single tree with indented rows | Swim lanes hide hierarchy; tree shows parent-child relationships directly |
| Collapsible popup on each bar (expand/collapse toggle) | Click bar to open detail panel (same as all other views) | Popup adds two clicks, shows redundant info (priority, "view details" link), adds visual noise |
| Weekly goals as tiny pills | All goals get full-width bars with title labels | Small pills are unreadable; bars with titles are scannable |
| `useGoals()` flat list | `useGoalTree()` hierarchical data | Flat list has no parent-child info; tree data is already available and used by TreeView |
| `flattenByHorizon()` for swim lane grouping | `flattenTree()` for depth-aware row rendering | Grouping by horizon is what the user wants to remove |

**No technology changes.** The stack is identical. The change is purely architectural: from swim-lane grouping to tree-row gantt layout.

## Open Questions

1. **Tree panel width**
   - What we know: The tree panel needs enough width for 3-4 levels of indentation plus goal titles.
   - What's unclear: Is 240px sufficient? Deeply nested goals with long titles will truncate.
   - Recommendation: Use 240px as default. Goal titles truncate with `text-overflow: ellipsis`. The title is also shown on the bar itself, so the tree label serves as orientation, not the only place to read titles. The user can always click to open the detail panel for the full title.

2. **Bar labels vs tree labels**
   - What we know: Both the tree row and the bar show the goal title.
   - What's unclear: Should bars always show titles, or only when wide enough?
   - Recommendation: Always show titles on bars. Use CSS `overflow: hidden; text-overflow: ellipsis` with `min-width: 2rem`. At very narrow widths (weekly goals at year zoom), the title truncates to just the first few characters, but the tree label provides the full readable name.

3. **Progress visualization on bars**
   - What we know: The current popup shows a progress bar. The redesign removes the popup.
   - What's unclear: How should progress appear on the gantt bar?
   - Recommendation: Show progress as a semi-transparent fill within the bar itself (a colored overlay filling N% from the left). This is the standard gantt progress pattern. Completed goals get full fill plus a subtle checkmark or strikethrough on the title.

4. **Mobile layout**
   - What we know: The gantt chart is inherently wide. Mobile screens cannot show both tree panel and bars.
   - What's unclear: Should mobile hide the tree panel and show only bars? Or keep the tree panel very narrow?
   - Recommendation: On mobile (< 768px), hide the tree panel entirely. Show only the bars with the goal title on each bar (they already show titles). The tree panel is for desktop orientation. Users on mobile can use the Tree View for hierarchy exploration and the Timeline View for temporal overview.

## Sources

### Primary (HIGH confidence)

- **Project codebase** (local disk at `/Users/Shared/Domain/Code/Personal/goals/`): All source files inspected directly. Key files:
  - `components/goals/goal-timeline-view.tsx` (333 lines, current swim-lane implementation)
  - `components/goals/goal-timeline-node.tsx` (141 lines, current Collapsible node)
  - `lib/timeline-utils.ts` (209 lines, date math and positioning)
  - `lib/stores/ui-store.ts` (139 lines, zoom/year/month state at version 5)
  - `lib/hooks/use-goals.ts` (`useGoalTree()` returns `TreeGoal[]` with nested children)
  - `lib/tree-filter.ts` (shared tree filter, already extracted)
  - `components/goals/goal-tree-view.tsx` (tree view for comparison of hierarchy rendering)
  - `components/goals/goal-tree-node.tsx` (tree node with indentation, expand/collapse, selectGoal pattern)
  - `app/(app)/goals/page.tsx` (goals page integration, two-panel detail layout)
  - `lib/services/goal-service.ts` (`getTree()` returns 4-level nested Prisma query)

- **CSS Grid Gantt Chart pattern** (freeCodeCamp): Confirms `grid-template-columns` with repeating fractions and `grid-column` for bar positioning as the standard approach.

### Secondary (MEDIUM confidence)

- **Gantt chart UX pattern** (observed across Syncfusion, SVAR, DHTMLX docs): The split-panel tree+bars layout with frozen left column is the universal gantt chart pattern. All major libraries implement it. The redesign follows this established pattern rather than inventing a new one.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new dependencies, all libraries already installed and proven
- Architecture: HIGH, the split-panel gantt with CSS Grid is a well-documented pattern; the project already uses CSS Grid for the current timeline; the tree data and filtering already exist
- Pitfalls: HIGH, identified from direct analysis of the current implementation and its known problems
- Redesign scope: HIGH, changes are confined to two component files and one utility file; no backend, API, store migration, or data model changes needed

**Research date:** 8. 4. 2026
**Valid until:** 8. 5. 2026 (stable; no external library dependencies to track)
