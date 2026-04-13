"use client";

import { useMemo } from "react";
import { parseISO, addDays, startOfWeek, format } from "date-fns";
import { Flame, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useStreakHistory } from "@/lib/hooks/use-todos";

interface StreakDay {
  date: string;
  status: "completed" | "missed" | "pending" | "none";
}

interface StreakData {
  templateId: string;
  currentStreak: number;
  longestStreak: number;
  consistencyScore: number;
  days: StreakDay[];
}

const STATUS_COLORS: Record<StreakDay["status"], string> = {
  none: "bg-muted",
  completed: "bg-green-500",
  missed: "bg-red-400/60",
  pending: "bg-muted-foreground/20",
};

const STATUS_LABELS: Record<StreakDay["status"], string> = {
  none: "No data",
  completed: "Completed",
  missed: "Missed",
  pending: "Pending",
};

/** Day-of-week labels for rows. Only Mon, Wed, Fri shown to avoid crowding. */
const DOW_LABELS: Array<{ label: string; show: boolean }> = [
  { label: "M", show: true },
  { label: "T", show: false },
  { label: "W", show: true },
  { label: "T", show: false },
  { label: "F", show: true },
  { label: "S", show: false },
  { label: "S", show: false },
];

interface StreakHeatmapProps {
  todoId: string;
}

export function StreakHeatmap({ todoId }: StreakHeatmapProps) {
  const { data, isLoading } = useStreakHistory(todoId) as {
    data: StreakData | undefined;
    isLoading: boolean;
  };

  const grid = useMemo(() => {
    if (!data?.days?.length) return [];

    // Build a lookup map from date string to status
    const statusMap = new Map<string, StreakDay["status"]>();
    for (const day of data.days) {
      statusMap.set(day.date, day.status);
    }

    // Determine the date range from the data
    const dates = data.days.map((d) => parseISO(d.date));
    const earliest = dates.reduce((a, b) => (a < b ? a : b));
    const latest = dates.reduce((a, b) => (a > b ? a : b));

    // Grid start: Monday on or before the earliest date (weekStartsOn: 1 = Monday)
    const gridStart = startOfWeek(earliest, { weekStartsOn: 1 });

    // Build cells from gridStart through latest date
    const cells: Array<{
      date: Date;
      dateStr: string;
      status: StreakDay["status"];
      dow: number; // 0=Mon, 1=Tue, ..., 6=Sun
      week: number;
    }> = [];

    let current = gridStart;
    let weekIndex = 0;
    let prevWeekStart = gridStart;

    while (current <= latest) {
      const weekStart = startOfWeek(current, { weekStartsOn: 1 });
      if (weekStart.getTime() !== prevWeekStart.getTime()) {
        weekIndex++;
        prevWeekStart = weekStart;
      }

      // Day of week: 0=Mon through 6=Sun
      const jsDay = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const dow = jsDay === 0 ? 6 : jsDay - 1;

      const dateStr = format(current, "yyyy-MM-dd");
      const status = statusMap.get(dateStr) ?? "none";

      cells.push({ date: current, dateStr, status, dow, week: weekIndex });
      current = addDays(current, 1);
    }

    return cells;
  }, [data]);

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-md" />;
  }

  if (!data || data.days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No streak data yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 mt-3 pt-3 border-t">
      {/* Header stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Flame className="size-4 text-orange-500" />
          <span className="text-sm font-semibold tabular-nums">
            {data.currentStreak}
          </span>
          <span className="text-xs text-muted-foreground">current streak</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy className="size-4 text-amber-500" />
          <span className="text-sm font-semibold tabular-nums">
            {data.longestStreak}
          </span>
          <span className="text-xs text-muted-foreground">best</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Consistency:</span>
          <span className="text-sm font-semibold tabular-nums">
            {Math.round(data.consistencyScore * 100)}%
          </span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="flex gap-1">
        {/* Day-of-week labels column */}
        <div
          className="grid shrink-0"
          style={{
            gridTemplateRows: "repeat(7, 12px)",
            gap: "2px",
          }}
        >
          {DOW_LABELS.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-end pr-1 text-[10px] text-muted-foreground leading-none"
              style={{ height: "12px" }}
            >
              {item.show ? item.label : ""}
            </div>
          ))}
        </div>

        {/* Grid cells */}
        <div
          className="grid overflow-x-auto"
          style={{
            gridTemplateRows: "repeat(7, 12px)",
            gridAutoFlow: "column",
            gridAutoColumns: "12px",
            gap: "2px",
          }}
        >
          {/* Fill leading empty cells for partial first week */}
          {grid.length > 0 &&
            grid[0].dow > 0 &&
            Array.from({ length: grid[0].dow }).map((_, i) => (
              <div key={`pad-${i}`} className="size-3" />
            ))}

          {grid.map((cell) => (
            <div
              key={cell.dateStr}
              className={`size-3 rounded-sm ${STATUS_COLORS[cell.status]}`}
              title={`${format(cell.date, "d. M. yyyy")}: ${STATUS_LABELS[cell.status]}`}
            />
          ))}

          {/* Fill trailing empty cells for partial last week */}
          {grid.length > 0 &&
            grid[grid.length - 1].dow < 6 &&
            Array.from({ length: 6 - grid[grid.length - 1].dow }).map(
              (_, i) => <div key={`trail-${i}`} className="size-3" />,
            )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="flex items-center gap-0.5">
          <div className="size-2.5 rounded-sm bg-muted" />
          <div className="size-2.5 rounded-sm bg-muted-foreground/20" />
          <div className="size-2.5 rounded-sm bg-red-400/60" />
          <div className="size-2.5 rounded-sm bg-green-500" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
