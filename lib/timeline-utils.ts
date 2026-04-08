import {
  eachQuarterOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  startOfQuarter,
  endOfQuarter,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
} from "date-fns";
import type { TreeGoal } from "@/lib/hooks/use-goals";

export type TimelineZoom = "year" | "quarter" | "month";

export interface TimeSegment {
  label: string;
  start: Date;
  end: Date;
  columnStart: number;
  columnEnd: number;
}

export interface TimelineGoal extends TreeGoal {
  depth: number;
}

/**
 * Generate time segments for a given year at the specified zoom level.
 * Each segment maps to one or more CSS grid columns.
 */
export function getTimeSegments(year: number, zoom: TimelineZoom): TimeSegment[] {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const interval = { start: yearStart, end: yearEnd };

  if (zoom === "year") {
    // 4 segments: Q1, Q2, Q3, Q4
    const quarters = eachQuarterOfInterval(interval);
    return quarters.map((q, i) => ({
      label: `Q${i + 1}`,
      start: startOfQuarter(q),
      end: endOfQuarter(q),
      columnStart: i + 1,
      columnEnd: i + 2,
    }));
  }

  if (zoom === "quarter") {
    // 12 segments: Jan, Feb, ..., Dec
    const months = eachMonthOfInterval(interval);
    return months.map((m, i) => ({
      label: m.toLocaleDateString("en", { month: "short" }),
      start: startOfMonth(m),
      end: endOfMonth(m),
      columnStart: i + 1,
      columnEnd: i + 2,
    }));
  }

  // zoom === "month": weekly segments
  const weeks = eachWeekOfInterval(interval, { weekStartsOn: 1 });
  return weeks.map((w, i) => ({
    label: `W${i + 1}`,
    start: startOfWeek(w, { weekStartsOn: 1 }),
    end: endOfWeek(w, { weekStartsOn: 1 }),
    columnStart: i + 1,
    columnEnd: i + 2,
  }));
}

/**
 * Determine the grid column span for a goal based on its dates or horizon fallback.
 * Returns null if segments is empty.
 */
export function getGoalColumns(
  goal: { startDate?: string | null; deadline?: string | null; horizon: string },
  segments: TimeSegment[],
  year: number,
): { start: number; end: number } | null {
  if (segments.length === 0) return null;

  const goalStart = goal.startDate ? new Date(goal.startDate) : null;
  const goalEnd = goal.deadline ? new Date(goal.deadline) : null;

  // Both dates are null: apply horizon-based fallback
  if (!goalStart && !goalEnd) {
    return getHorizonFallback(goal.horizon, segments);
  }

  // When only deadline exists (no startDate), infer a start based on horizon
  // so the bar has a visible width instead of collapsing to a dot.
  const inferredStart = (() => {
    if (goalStart) return goalStart;
    if (!goalEnd) return goalEnd;
    const d = new Date(goalEnd);
    switch (goal.horizon) {
      case "YEARLY": d.setMonth(d.getMonth() - 12); break;
      case "QUARTERLY": d.setMonth(d.getMonth() - 3); break;
      case "MONTHLY": d.setDate(d.getDate() - 28); break;
      case "WEEKLY": d.setDate(d.getDate() - 7); break;
      default: d.setDate(d.getDate() - 14); break;
    }
    return d;
  })();

  const effectiveStart = inferredStart ?? goalEnd!;
  const effectiveEnd = goalEnd ?? goalStart!;

  let startCol = segments.findIndex(
    (s) => effectiveStart >= s.start && effectiveStart <= s.end,
  );
  let endCol = segments.findIndex(
    (s) => effectiveEnd >= s.start && effectiveEnd <= s.end,
  );

  // Clamp for dates outside the year range
  if (startCol === -1) {
    startCol = effectiveStart < segments[0].start ? 0 : segments.length - 1;
  }
  if (endCol === -1) {
    endCol = effectiveEnd < segments[0].start ? 0 : segments.length - 1;
  }

  // Ensure start <= end
  if (startCol > endCol) {
    const tmp = startCol;
    startCol = endCol;
    endCol = tmp;
  }

  return {
    start: segments[startCol].columnStart,
    end: segments[endCol].columnEnd,
  };
}

/**
 * Horizon-based fallback positioning when a goal has no dates.
 */
function getHorizonFallback(
  horizon: string,
  segments: TimeSegment[],
): { start: number; end: number } {
  const last = segments[segments.length - 1];
  const count = segments.length;

  switch (horizon) {
    case "YEARLY":
      // Span the full year
      return { start: segments[0].columnStart, end: last.columnEnd };
    case "QUARTERLY":
      // Span first 3 segments (or fewer if not enough)
      return {
        start: segments[0].columnStart,
        end: segments[Math.min(2, count - 1)].columnEnd,
      };
    case "MONTHLY":
      // Span first segment
      return {
        start: segments[0].columnStart,
        end: segments[Math.min(0, count - 1)].columnEnd,
      };
    case "WEEKLY":
      // Span first segment
      return {
        start: segments[0].columnStart,
        end: segments[Math.min(0, count - 1)].columnEnd,
      };
    default:
      return { start: segments[0].columnStart, end: last.columnEnd };
  }
}

/**
 * Flatten a tree of goals into a record grouped by horizon, preserving children
 * for inline expansion in Plan 02.
 */
export function flattenByHorizon(tree: TreeGoal[]): Record<string, TimelineGoal[]> {
  const result: Record<string, TimelineGoal[]> = {
    YEARLY: [],
    QUARTERLY: [],
    MONTHLY: [],
    WEEKLY: [],
  };

  function walk(goals: TreeGoal[], depth: number) {
    for (const goal of goals) {
      const horizon = goal.horizon;
      if (result[horizon]) {
        result[horizon].push({ ...goal, depth });
      }
      walk(goal.children, depth + 1);
    }
  }

  walk(tree, 0);
  return result;
}
