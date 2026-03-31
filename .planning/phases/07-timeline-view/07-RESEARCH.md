# Phase 7: Timeline View — Research

**Researched:** 2026-03-30
**Domain:** Custom horizontal timeline visualization (React, CSS Grid, date math)
**Confidence:** HIGH

## Summary

Phase 7 adds a horizontal timeline view to the existing goals page where users can visualize their entire year with goals positioned at their horizon level (yearly, quarterly, monthly, weekly). The timeline displays a horizontal year line with quarter markers that can expand to show months and weeks, with goals rendered as interactive nodes at the appropriate time positions. Clicking a goal node expands its details inline, showing children, progress, and notes.

The codebase already provides all the data infrastructure this view needs. The `goalService.getTree()` method returns 4-level nested hierarchical data (yearly > quarterly > monthly > weekly), the `useGoalTree()` hook wraps it with React Query caching, and the `/api/goals/tree` route is already deployed. The existing tree view's filter pruning logic (`filterTree()` in `GoalTreeView`) can be reused directly. The view switcher has a disabled "timeline" placeholder ready to enable, and the goals page has `PLACEHOLDER_VIEWS["timeline"]` ready to be replaced with a real component.

No external timeline or Gantt library is needed. The timeline is a custom layout problem, not a charting problem. CSS Grid provides precise column placement for time segments, `date-fns` (already installed) handles all date calculations, and the four horizon levels map naturally to visual swim lanes. External Gantt libraries (Syncfusion, SVAR, Bryntum) are massively overengineered for this use case: they focus on task dependencies, resource allocation, and critical path analysis, none of which apply to a personal goal hierarchy. Building a custom timeline component keeps the bundle small and gives full design control.

**Primary recommendation:** Build a custom timeline using CSS Grid for the time axis layout, with four horizontal swim lanes (one per horizon level), goals positioned as interactive nodes using grid column placement calculated from their dates, and collapsible inline detail panels using the existing `@base-ui/react` Collapsible component.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-05 | Timeline view shows a horizontal year line with quarter markers, expandable to months and weeks | CSS Grid timeline layout with configurable zoom levels (year, quarter, month). Grid columns represent time segments. Quarter markers are always visible; expanding to months/weeks increases the column count and enables horizontal scrolling. |
| VIEW-06 | Timeline goals appear as interactive nodes on the line at their horizon level | Four swim lanes (rows) for YEARLY/QUARTERLY/MONTHLY/WEEKLY. Goals positioned using CSS Grid `grid-column` calculated from their date range (startDate to deadline) or horizon period. Click triggers `selectGoal()` to open the detail panel, following the same pattern as all other views. |
| VIEW-07 | Clicking a goal node on the timeline expands details inline (children, progress, notes) | Collapsible inline panel rendered below the goal node using `@base-ui/react` Collapsible (already used in tree view). Shows children list, progress bar, and notes excerpt. Reuses `ChildrenList` component pattern. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.4 | Component rendering | Already in project |
| CSS Grid | Native | Timeline layout with precise column placement | No library needed; grid-column start/end maps directly to time segments |
| date-fns | 4.1.0 | Date calculations (quarter boundaries, month ranges, week numbers) | Already in project; provides `startOfYear`, `endOfYear`, `eachQuarterOfInterval`, `eachMonthOfInterval`, `differenceInDays`, `getQuarter`, `getWeek` |
| Zustand | 5.0.12 | Timeline zoom level state persistence | Already in project; extend UI store with `timelineZoom` |
| @tanstack/react-query | 5.95.2 | Data fetching via existing `useGoalTree()` hook | Already in project and hook already exists |
| @base-ui/react Collapsible | 1.3.0 | Inline detail expansion on goal nodes | Already installed; used in tree view and sidebar |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.7.0 | Icons for zoom controls, expand/collapse, node decorators | Already in project |
| clsx + tailwind-merge | Already installed | Conditional class composition for timeline node states | Already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS Grid timeline | Bryntum Gantt / Syncfusion Gantt | Massive bundle size (500KB+), commercial license required, designed for project management (dependencies, critical path) not personal goals. Overkill. |
| Custom CSS Grid timeline | vis-timeline / vis.js | General-purpose timeline but adds ~200KB, has its own DOM management that conflicts with React state, and the styling is hard to customize to match the existing design system. |
| Custom CSS Grid timeline | react-horizontal-timeline | Minimal library focused on event timelines (discrete points), not continuous swim lanes with goal spans. Wrong abstraction. |
| CSS Grid for layout | SVG-based rendering | SVG adds complexity (coordinate math, viewBox management, text wrapping) without benefit. CSS Grid handles the layout natively with responsive design, text overflow, and accessibility built in. |

**Installation:**
```bash
# No new packages needed. All required libraries are already installed.
```

## Architecture Patterns

### Recommended Project Structure

```
components/
├── goals/
│   ├── goal-timeline-view.tsx       # Main timeline container (zoom controls, scroll wrapper, swim lanes)
│   ├── goal-timeline-header.tsx     # Time axis header (quarter/month/week labels)
│   ├── goal-timeline-lane.tsx       # Single swim lane for one horizon level
│   └── goal-timeline-node.tsx       # Individual goal node with inline expansion
lib/
├── stores/
│   └── ui-store.ts                  # Add timelineZoom state
├── hooks/
│   └── use-goals.ts                 # useGoalTree() already exists, no changes needed
├── timeline-utils.ts                # Date math helpers for grid column placement
```

### Pattern 1: CSS Grid Time Axis Layout

**What:** Use a CSS Grid where each column represents a time segment (quarter, month, or week depending on zoom level). Goals span one or more columns based on their date range. Swim lanes (horizon levels) are separate grid rows.

**When to use:** When rendering a timeline where items need precise temporal positioning without an external library.

**Example:**
```typescript
// timeline-utils.ts

import {
  startOfYear,
  endOfYear,
  eachQuarterOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  differenceInDays,
  startOfQuarter,
  endOfQuarter,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";

export type TimelineZoom = "year" | "quarter" | "month";

export interface TimeSegment {
  label: string;
  start: Date;
  end: Date;
  columnStart: number;
  columnEnd: number;
}

/**
 * Generate time segments for the grid columns based on zoom level.
 * "year" zoom: 4 columns (Q1, Q2, Q3, Q4)
 * "quarter" zoom: 12 columns (Jan through Dec)
 * "month" zoom: ~52 columns (Week 1 through Week 52)
 */
export function getTimeSegments(year: number, zoom: TimelineZoom): TimeSegment[] {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));

  switch (zoom) {
    case "year": {
      const quarters = eachQuarterOfInterval({ start: yearStart, end: yearEnd });
      return quarters.map((q, i) => ({
        label: `Q${i + 1}`,
        start: startOfQuarter(q),
        end: endOfQuarter(q),
        columnStart: i + 1,
        columnEnd: i + 2,
      }));
    }
    case "quarter": {
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
      return months.map((m, i) => ({
        label: m.toLocaleDateString("en", { month: "short" }),
        start: startOfMonth(m),
        end: endOfMonth(m),
        columnStart: i + 1,
        columnEnd: i + 2,
      }));
    }
    case "month": {
      const weeks = eachWeekOfInterval(
        { start: yearStart, end: yearEnd },
        { weekStartsOn: 1 }
      );
      return weeks.map((w, i) => ({
        label: `W${i + 1}`,
        start: startOfWeek(w, { weekStartsOn: 1 }),
        end: endOfWeek(w, { weekStartsOn: 1 }),
        columnStart: i + 1,
        columnEnd: i + 2,
      }));
    }
  }
}

/**
 * Calculate which grid columns a goal should span based on its dates.
 * Falls back to horizon-based defaults when dates are missing.
 */
export function getGoalColumns(
  goal: { startDate?: string | null; deadline?: string | null; horizon: string },
  segments: TimeSegment[],
  year: number,
): { start: number; end: number } | null {
  if (segments.length === 0) return null;

  const goalStart = goal.startDate ? new Date(goal.startDate) : null;
  const goalEnd = goal.deadline ? new Date(goal.deadline) : null;

  // Find overlapping segments
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  const effectiveStart = goalStart ?? firstSeg.start;
  const effectiveEnd = goalEnd ?? lastSeg.end;

  // Find the segment containing the start date
  let startCol = segments.findIndex(
    (s) => effectiveStart >= s.start && effectiveStart <= s.end
  );
  if (startCol < 0) startCol = 0;

  // Find the segment containing the end date
  let endCol = segments.findIndex(
    (s) => effectiveEnd >= s.start && effectiveEnd <= s.end
  );
  if (endCol < 0) endCol = segments.length - 1;

  return {
    start: segments[startCol].columnStart,
    end: segments[endCol].columnEnd,
  };
}
```

### Pattern 2: Swim Lane Layout per Horizon

**What:** Four horizontal swim lanes, one per horizon level (YEARLY, QUARTERLY, MONTHLY, WEEKLY). Each lane is a CSS Grid row that shares the same time axis columns as the header. Goals are placed within their corresponding lane.

**When to use:** When the hierarchy has fixed, known levels that map to distinct visual rows.

**Example:**
```typescript
const HORIZON_LANES = [
  { horizon: "YEARLY", label: "Yearly Goals", height: "h-16" },
  { horizon: "QUARTERLY", label: "Quarterly", height: "h-14" },
  { horizon: "MONTHLY", label: "Monthly", height: "h-12" },
  { horizon: "WEEKLY", label: "Weekly", height: "h-10" },
] as const;

// In the timeline component:
// Each lane renders its own grid with the same column template
// Goals within a lane are positioned using gridColumn
```

### Pattern 3: Zoom Level State in UI Store

**What:** Add a `timelineZoom` field to the Zustand UI store. This persists the user's preferred zoom level across page navigations and sessions, following the same pattern as `activeView`, `activeFilters`, and `boardGroupBy`.

**When to use:** So the user does not need to re-select their zoom level every time they visit the timeline.

**Example:**
```typescript
// Extend UIStore
timelineZoom: "year" | "quarter" | "month";
setTimelineZoom: (zoom: "year" | "quarter" | "month") => void;

// In persist partialize:
timelineZoom: state.timelineZoom,

// In persist migrate (version 2 -> 3):
if (version === 2) {
  return { ...state, timelineZoom: "quarter" };
}
```

### Pattern 4: Inline Detail Expansion

**What:** Clicking a goal node on the timeline toggles an inline detail panel below the node (or below the lane) using the `@base-ui/react` Collapsible component. This panel shows children, progress bar, notes excerpt, and a link to open the full detail panel.

**When to use:** For VIEW-07 requirement. Users want quick context without leaving the timeline view.

**Example:**
```typescript
function GoalTimelineNode({ goal, segments, year }: Props) {
  const [expanded, setExpanded] = useState(false);
  const selectGoal = useUIStore((s) => s.selectGoal);
  const cols = getGoalColumns(goal, segments, year);
  if (!cols) return null;

  return (
    <div style={{ gridColumn: `${cols.start} / ${cols.end}` }}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="w-full rounded-md px-2 py-1 text-xs font-medium truncate ..."
            />
          }
        >
          {goal.title}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-2 text-xs space-y-1">
            {/* Progress */}
            {goal.progress > 0 && <ProgressBar value={goal.progress} />}
            {/* Children summary */}
            {goal.children.length > 0 && (
              <p>{goal.children.length} sub-goals</p>
            )}
            {/* Open full detail */}
            <button onClick={() => selectGoal(goal.id)}>
              View details
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Using an external Gantt library:** These are designed for project management (task dependencies, resource leveling, critical path). They add 200KB+ to the bundle and fight against the existing design system. This is a 4-lane timeline with positioned nodes, not a PM tool.
- **SVG-based rendering:** Introduces coordinate math, viewBox complexity, and text wrapping problems. CSS Grid handles all of this natively with responsive design, text overflow, and accessibility.
- **Rendering all zoom levels simultaneously:** Only render the columns for the active zoom level. Switching from "year" (4 columns) to "month" (52 columns) should swap the grid template, not show all columns with varying visibility.
- **Putting timeline zoom state in local component state:** The zoom level is a user preference. Persist it in the Zustand store alongside the existing view/filter preferences.
- **Absolute pixel positioning for goals:** Use CSS Grid `grid-column` for temporal placement. Absolute positioning leads to overlapping elements, broken responsiveness, and manual resize calculations.
- **Rendering all goal nodes in the DOM at once for month zoom (52 weeks):** At month zoom with 100+ goals, the DOM can get large. Use `React.memo()` on timeline nodes and consider conditional rendering for off-screen lanes. Full virtualization is unlikely to be necessary at the expected scale (< 200 goals), but the architecture should not prevent adding it later.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date interval generation | Manual quarter/month/week calculation loops | `date-fns` interval functions (`eachQuarterOfInterval`, `eachMonthOfInterval`, `eachWeekOfInterval`) | Edge cases with year boundaries, leap years, week numbering. date-fns handles all of these correctly. |
| Expand/collapse animation for inline details | Custom CSS height transitions | `@base-ui/react` Collapsible | Already used in tree view; handles height animation and accessibility attributes automatically |
| Tooltip on hover for goal nodes | Custom mouse position tracking | `@base-ui/react` Tooltip | Already used in view switcher; consistent behavior and positioning |
| Horizontal scroll snapping | Manual scroll event handling | CSS `scroll-snap-type: x mandatory` on the scroll container | Native browser support; no JavaScript needed for smooth snap-to-column scrolling |

**Key insight:** The timeline view is primarily a CSS Grid layout problem with date math for column placement. The React components are thin wrappers around grid positioning. The complexity lives in the `timeline-utils.ts` date calculation module, not in the rendering layer.

## Common Pitfalls

### Pitfall 1: Goals Without Dates Have No Position

**What goes wrong:** Many goals will not have a `startDate` or `deadline` set. These goals have no temporal position and cannot be placed on the timeline.

**Why it happens:** The goal creation forms make dates optional. Users often create goals with just a title, horizon, and priority.

**How to avoid:** Implement a fallback positioning strategy based on the goal's horizon:
- YEARLY goals without dates: span the full year
- QUARTERLY goals without dates: span Q1 by default or the quarter their parent covers
- MONTHLY goals without dates: span the first month of their parent's quarter
- WEEKLY goals without dates: span the first week of their parent's month

Additionally, consider a visual indicator (dashed border or muted opacity) for goals positioned by fallback rather than explicit dates.

**Warning signs:** Blank swim lanes when goals exist but have no date fields.

### Pitfall 2: Overlapping Nodes in the Same Lane

**What goes wrong:** Multiple goals at the same horizon level covering the same time range will overlap on the grid, making them unreadable.

**Why it happens:** CSS Grid items placed in the same cell stack on top of each other by default.

**How to avoid:** Within each swim lane, detect overlapping goals and stack them vertically. Each lane becomes a sub-grid or flex column where overlapping goals stack below each other rather than on top. Alternatively, use CSS `grid-auto-flow: dense` with explicit row assignment per goal within the lane.

**Warning signs:** Goals visually hidden behind other goals; users report "missing" goals that actually exist.

### Pitfall 3: Horizontal Scroll Losing the "Today" Marker

**What goes wrong:** At month zoom (52 columns), the timeline is wider than the viewport and requires horizontal scrolling. Users scroll to a different month and lose track of where "today" is.

**Why it happens:** No persistent visual indicator of the current date position.

**How to avoid:** Add a vertical "today" line that spans all swim lanes, styled as a thin accent-colored line. When the timeline first loads, auto-scroll to center the current date in the viewport. The today marker stays visible as a fixed reference point.

**Warning signs:** Users cannot quickly find the current week in a 52-column timeline.

### Pitfall 4: Performance at Month Zoom with Many Goals

**What goes wrong:** Month zoom renders 52 column headers and potentially 100+ goal nodes, causing sluggish scrolling on mobile.

**Why it happens:** Large DOM with many grid items, each with interactive elements and possible expansion panels.

**How to avoid:** Use `React.memo()` on `GoalTimelineNode` components. Keep expanded state local to each node (not in the store). Consider lazy rendering of swim lanes that are scrolled out of view vertically. The STATE.md blocker note ("Timeline visualization performance on mobile needs benchmarking in Phase 7") is addressed by this approach.

**Warning signs:** Jank when scrolling horizontally at month zoom on mobile Safari.

### Pitfall 5: Zustand Persist Version Migration

**What goes wrong:** Adding `timelineZoom` to the persisted store without a migration breaks existing users' localStorage.

**Why it happens:** The store version is currently 2 (bumped in Phase 6 for `boardGroupBy`). Adding new persisted fields requires incrementing to version 3 with a migration callback.

**How to avoid:** Follow the established pattern: bump version to 3, add a migration case for version 2 that adds `timelineZoom: "quarter"` as the default, and include `timelineZoom` in the `partialize` function.

**Warning signs:** Console errors about undefined state properties; timeline zoom resets on every page load.

## Code Examples

### Timeline View Integration Point (goals page)

The current goals page has this placeholder logic:

```typescript
// In app/(app)/goals/page.tsx
const PLACEHOLDER_VIEWS: Record<string, { icon: typeof Columns3Icon; label: string }> = {
  timeline: { icon: GanttChartIcon, label: "Timeline view coming in Phase 7" },
};
```

Replace with real rendering:

```typescript
// Remove "timeline" from PLACEHOLDER_VIEWS (it becomes empty or removed entirely)
// Add rendering case:
if (activeView === "timeline") {
  return (
    <div className="p-4">
      <GoalTimelineView />
    </div>
  );
}
```

### View Switcher Update

Enable timeline in the view switcher:

```typescript
// In goal-view-switcher.tsx VIEW_OPTIONS
{ value: "timeline", label: "Timeline", icon: GanttChart, enabled: true },
```

### Reusing Tree Filter Logic

The existing `filterTree()` function from `GoalTreeView` should be extracted to a shared utility so both the tree view and timeline view can use it:

```typescript
// lib/tree-filter.ts (extract from components/goals/goal-tree-view.tsx)
import type { TreeGoal } from "@/lib/hooks/use-goals";
import type { ActiveFilters } from "@/lib/stores/ui-store";

export function nodeMatches(goal: TreeGoal, filters: ActiveFilters): boolean {
  if (filters.horizon && goal.horizon !== filters.horizon) return false;
  if (filters.status && goal.status !== filters.status) return false;
  if (filters.priority && goal.priority !== filters.priority) return false;
  if (filters.categoryId && goal.category?.id !== filters.categoryId) return false;
  return true;
}

export function filterTree(goals: TreeGoal[], filters: ActiveFilters): TreeGoal[] {
  const hasActiveFilter =
    filters.horizon || filters.status || filters.priority || filters.categoryId;
  if (!hasActiveFilter) return goals;

  return goals.reduce<TreeGoal[]>((acc, goal) => {
    const filteredChildren = filterTree(goal.children, filters);
    const selfMatches = nodeMatches(goal, filters);
    if (selfMatches || filteredChildren.length > 0) {
      acc.push({ ...goal, children: filteredChildren });
    }
    return acc;
  }, []);
}
```

### Flattening Tree for Lane Rendering

The timeline needs goals grouped by horizon (for swim lanes), not nested:

```typescript
// In timeline-utils.ts
import type { TreeGoal } from "@/lib/hooks/use-goals";

export interface TimelineGoal extends TreeGoal {
  depth: number;
}

/**
 * Flatten the tree into a list grouped by horizon level.
 * Preserves the children array on each goal for inline expansion.
 */
export function flattenByHorizon(
  tree: TreeGoal[],
): Record<string, TimelineGoal[]> {
  const result: Record<string, TimelineGoal[]> = {
    YEARLY: [],
    QUARTERLY: [],
    MONTHLY: [],
    WEEKLY: [],
  };

  function walk(goals: TreeGoal[], depth: number) {
    for (const goal of goals) {
      result[goal.horizon]?.push({ ...goal, depth });
      if (goal.children.length > 0) {
        walk(goal.children, depth + 1);
      }
    }
  }

  walk(tree, 0);
  return result;
}
```

### Today Marker

```typescript
function TodayMarker({ segments }: { segments: TimeSegment[] }) {
  const today = new Date();
  const segIndex = segments.findIndex(
    (s) => today >= s.start && today <= s.end
  );
  if (segIndex < 0) return null;

  // Calculate fractional position within the segment
  const seg = segments[segIndex];
  const totalDays = differenceInDays(seg.end, seg.start) || 1;
  const dayOffset = differenceInDays(today, seg.start);
  const fraction = dayOffset / totalDays;

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-primary/60 z-10 pointer-events-none"
      style={{
        gridColumn: seg.columnStart,
        marginLeft: `${fraction * 100}%`,
      }}
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG-based timeline rendering | CSS Grid with grid-column placement | 2023+ (CSS Grid gap/subgrid maturity) | Simpler code, native responsiveness, text wrapping, accessibility |
| External Gantt libraries for any timeline | Custom CSS Grid for simple timelines; Gantt only for PM | 2024+ (bundle size awareness) | 200KB+ saved, no commercial license needed |
| Horizontal scroll with JavaScript listeners | CSS `scroll-snap-type` and `overflow-x: auto` | Widely supported since 2022 | Native smooth scrolling, no JS performance overhead |
| react-virtualized for horizontal lists | Direct rendering with React.memo for < 500 items | React 18+ | Virtualization overhead not justified at small scale |

**Deprecated/outdated:**
- `react-horizontal-timeline`: Last published 2020, designed for discrete event timelines (biography/resume style), not continuous swim lanes with goal spans. Wrong abstraction for this use case.
- `vis-timeline`: Maintained but heavy (~200KB), manages its own DOM outside React, making integration with React Query and Zustand awkward. Better suited for standalone dashboards, not embedded views in a React app.

## Open Questions

1. **Year navigation**
   - What we know: The timeline shows one year at a time. Goals may span multiple years (unlikely for v1 but possible).
   - What's unclear: Should the timeline default to the current year? Should there be year navigation arrows? What about goals that start in December and end in January?
   - Recommendation: Default to the current year. Add left/right arrows to navigate years. Goals that span year boundaries are clipped to the visible year with a visual indicator (arrow at the edge) that they continue.

2. **Mobile layout**
   - What we know: The timeline is inherently a wide, horizontal visualization. Mobile screens (< 768px) are narrow.
   - What's unclear: Should mobile show a simplified vertical timeline instead? Or the same horizontal timeline with mandatory horizontal scrolling?
   - Recommendation: Show the same horizontal timeline on mobile with horizontal scrolling. The zoom level on mobile should default to "year" (4 columns, fits in viewport). "Quarter" and "month" zoom levels scroll horizontally. This matches the roadmap requirement (VIEW-05 says "horizontal year line") and avoids building two completely different timeline layouts.

3. **Goal color coding**
   - What we know: Goals have a category with a color. Timeline nodes need visual differentiation.
   - What's unclear: Should nodes be colored by category, by status, or by priority?
   - Recommendation: Color the node background/border by category color (consistent with how category colors are used in tree view and board view dot indicators). Add a subtle status indicator (e.g., checkmark overlay for completed, muted opacity for abandoned).

## Sources

### Primary (HIGH confidence)

- **Project codebase** (local disk): All source files read directly from `/Users/Shared/Domain/Code/Personal/goals/`. Key files inspected:
  - `lib/services/goal-service.ts` (getTree method, line 112)
  - `lib/hooks/use-goals.ts` (useGoalTree hook, TreeGoal interface)
  - `lib/stores/ui-store.ts` (ViewType includes "timeline", persist version 2)
  - `app/(app)/goals/page.tsx` (PLACEHOLDER_VIEWS with timeline entry)
  - `components/goals/goal-view-switcher.tsx` (timeline disabled in VIEW_OPTIONS)
  - `components/goals/goal-tree-view.tsx` (filterTree logic for reuse)
  - `components/goals/goal-tree-node.tsx` (Collapsible pattern for inline expansion)
  - `lib/constants.ts` (HORIZON_ORDER)
  - `prisma/schema.prisma` (Goal model with startDate, deadline fields)
  - `package.json` (date-fns 4.1.0, @base-ui/react 1.3.0)

- **Phase 6 research** (`.planning/phases/06-board-and-tree-views/06-RESEARCH.md`): Established patterns for view creation, store extension, tree data fetching, and filter integration that Phase 7 follows.

- **date-fns documentation**: Interval functions (`eachQuarterOfInterval`, `eachMonthOfInterval`, `eachWeekOfInterval`, `differenceInDays`) verified as available in date-fns v4.

### Secondary (MEDIUM confidence)

- **CSS Grid for Gantt/timeline layouts** (freeCodeCamp, "How to Create a Simple Gantt Chart Using CSS Grid"): Confirms that CSS Grid `grid-column` placement is the standard approach for timeline positioning without external libraries.
- **Web search results** (multiple sources, 2025/2026): Confirmed that Gantt libraries (Syncfusion, SVAR, Bryntum) are designed for enterprise PM and are overkill for personal goal timelines. Confirmed that CSS `scroll-snap-type` is well-supported for horizontal scroll UX.

### Tertiary (LOW confidence)

- None. All findings are based on direct codebase inspection and verified web sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all libraries already installed, no new dependencies needed
- Architecture: HIGH, CSS Grid timeline is a well-understood pattern; project conventions for view creation established in Phases 3 and 6
- Pitfalls: HIGH, identified from direct analysis of the Goal model (optional dates), existing view patterns (store migration, filter integration), and the STATE.md performance concern
- Date math: HIGH, date-fns v4 interval functions verified through official docs

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable; no external library dependencies to track)
