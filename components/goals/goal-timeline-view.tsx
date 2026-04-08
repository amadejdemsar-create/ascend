"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { useGoals } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  getTimeSegments,
  getGoalColumns,
  type TimelineZoom,
  type TimelineGoal,
} from "@/lib/timeline-utils";
import { GoalTimelineNode } from "@/components/goals/goal-timeline-node";
import { differenceInDays } from "date-fns";
import { ChevronLeft, ChevronRight, GanttChart, SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ZOOM_OPTIONS: Array<{ value: TimelineZoom; label: string }> = [
  { value: "year", label: "Year" },
  { value: "quarter", label: "Quarter" },
  { value: "month", label: "Month" },
];

const HORIZON_LABELS: Record<string, string> = {
  YEARLY: "Yearly",
  QUARTERLY: "Quarterly",
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
};

const HORIZONS = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;

function getMinWidth(zoom: TimelineZoom): string {
  if (zoom === "month") return "3rem";
  if (zoom === "quarter") return "5rem";
  return "8rem";
}

function computeTodayPercent(timelineYear: number): number | null {
  const now = new Date();
  if (now.getFullYear() !== timelineYear) return null;
  const yearStart = new Date(timelineYear, 0, 1);
  const yearEnd = new Date(timelineYear, 11, 31);
  const totalDays = differenceInDays(yearEnd, yearStart) || 365;
  const daysElapsed = differenceInDays(now, yearStart);
  return Math.max(0, Math.min(100, (daysElapsed / totalDays) * 100));
}

function TodayMarker({ timelineYear }: { timelineYear: number }) {
  const todayPercent = computeTodayPercent(timelineYear);
  if (todayPercent === null) return null;

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-30 pointer-events-none"
      style={{
        left: `calc(8rem + (100% - 8rem) * ${todayPercent / 100})`,
      }}
    />
  );
}

export function GoalTimelineView() {
  const timelineZoom = useUIStore((s) => s.timelineZoom);
  const setTimelineZoom = useUIStore((s) => s.setTimelineZoom);
  const timelineYear = useUIStore((s) => s.timelineYear);
  const setTimelineYear = useUIStore((s) => s.setTimelineYear);
  const activeFilters = useUIStore((s) => s.activeFilters);

  interface GoalItem {
    id: string;
    title: string;
    status: string;
    horizon: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    progress: number;
    startDate: string | null;
    deadline: string | null;
    category: { id: string; name: string; color: string; icon: string | null } | null;
  }

  const { data: allGoals, isLoading } = useGoals();
  const scrollRef = useRef<HTMLDivElement>(null);
  const segments = getTimeSegments(timelineYear, timelineZoom);

  const goalsByHorizon = useMemo(() => {
    const goals = (allGoals ?? []) as GoalItem[];
    const result: Record<string, TimelineGoal[]> = {
      YEARLY: [],
      QUARTERLY: [],
      MONTHLY: [],
      WEEKLY: [],
    };
    for (const g of goals) {
      if (g.status === "ABANDONED") continue;
      if (activeFilters.horizon && g.horizon !== activeFilters.horizon) continue;
      if (activeFilters.status && g.status !== activeFilters.status) continue;
      if (activeFilters.priority && g.priority !== activeFilters.priority) continue;
      if (activeFilters.categoryId && g.category?.id !== activeFilters.categoryId) continue;
      if (result[g.horizon]) {
        result[g.horizon].push({
          id: g.id,
          title: g.title,
          status: g.status,
          horizon: g.horizon,
          priority: g.priority,
          progress: g.progress,
          startDate: g.startDate,
          deadline: g.deadline,
          category: g.category,
          children: [],
          depth: 0,
        });
      }
    }
    return result;
  }, [allGoals, activeFilters]);

  const minColWidth = getMinWidth(timelineZoom);
  const gridCols = `8rem repeat(${segments.length}, minmax(${minColWidth}, 1fr))`;

  // Auto-scroll to today on mount when viewing current year at month zoom
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const todayPercent = computeTodayPercent(timelineYear);
    if (todayPercent === null) return;
    if (timelineZoom !== "month") return;

    const scrollWidth = container.scrollWidth;
    const containerWidth = container.clientWidth;
    // Label column is 128px (8rem). Timeline area is the rest.
    const labelWidth = 128;
    const timelineWidth = scrollWidth - labelWidth;
    const todayScrollPos = labelWidth + (todayPercent / 100) * timelineWidth;
    container.scrollTo({
      left: todayScrollPos - containerWidth / 2,
      behavior: "smooth",
    });
  }, [timelineYear, timelineZoom]);

  const totalGoals = Object.values(goalsByHorizon).reduce((sum, arr) => sum + arr.length, 0);
  const hasGoals = (allGoals ?? []).length > 0;
  const hasFilteredGoals = totalGoals > 0;

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-3">
        {/* Year navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTimelineYear(timelineYear - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-mono text-sm font-semibold w-12 text-center">
            {timelineYear}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTimelineYear(timelineYear + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTimelineZoom(opt.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                timelineZoom === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline grid area */}
      {isLoading ? (
        <div className="rounded-lg border p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : hasFilteredGoals ? (
        <div
          ref={scrollRef}
          className="overflow-x-auto rounded-lg border relative"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* Today marker overlay */}
          <TodayMarker timelineYear={timelineYear} />

          <div
            style={{ display: "grid", gridTemplateColumns: gridCols }}
            className="min-w-fit"
          >
            {/* Header row: empty label cell + segment labels */}
            <div className="sticky left-0 z-20 bg-muted/80 border-b border-r px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur" />
            {segments.map((seg, i) => (
              <div
                key={i}
                className="border-b px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                style={{ scrollSnapAlign: "start" }}
              >
                {seg.label}
              </div>
            ))}

            {/* Swim lane rows */}
            {HORIZONS.map((horizon) => {
              const horizonLabel = HORIZON_LABELS[horizon];
              const goalsInLane = goalsByHorizon[horizon] ?? [];

              return (
                <React.Fragment key={horizon}>
                  {/* Lane label cell (sticky left) */}
                  <div className="sticky left-0 z-20 bg-muted/40 border-b border-r px-3 py-3 text-xs font-semibold text-muted-foreground backdrop-blur flex items-start">
                    {horizonLabel}
                    {goalsInLane.length > 0 && (
                      <span className="ml-1 text-[10px] text-muted-foreground/60">
                        ({goalsInLane.length})
                      </span>
                    )}
                  </div>

                  {/* Lane content area spanning all segment columns */}
                  <div
                    className="col-span-full border-b bg-background/50 relative"
                    style={{
                      gridColumn: `2 / ${segments.length + 2}`,
                      display: "grid",
                      gridTemplateColumns: `repeat(${segments.length}, minmax(${minColWidth}, 1fr))`,
                      gridAutoFlow: "row dense",
                      gridAutoRows: "auto",
                    }}
                  >
                    {goalsInLane.length === 0 && (
                      <div className="col-span-full flex items-center justify-center py-4 text-xs text-muted-foreground/40">
                        No {horizonLabel.toLowerCase()} goals
                      </div>
                    )}
                    {goalsInLane.length > 0 &&
                      goalsInLane.map((goal) => {
                        const cols = getGoalColumns(
                          goal,
                          segments,
                          timelineYear,
                        );
                        if (!cols) return null;
                        return (
                          <GoalTimelineNode
                            key={goal.id}
                            goal={goal}
                            gridColumn={`${cols.start} / ${cols.end}`}
                            hasDates={!!goal.deadline}
                          />
                        );
                      })}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Empty state: no goals at all */}
      {!isLoading && !hasGoals && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GanttChart className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No goals in timeline</p>
          <p className="mt-2 max-w-sm text-xs text-muted-foreground/70">
            Goals need a deadline to appear on the timeline. Add deadlines to your goals from the goal detail panel or when creating new goals.
          </p>
        </div>
      )}

      {/* Empty state: no goals match filters */}
      {!isLoading && hasGoals && !hasFilteredGoals && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SearchX className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">
            No goals match current filters
          </p>
        </div>
      )}
    </div>
  );
}
