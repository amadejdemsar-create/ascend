"use client";

import React from "react";
import { useGoalTree } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  getTimeSegments,
  getGoalColumns,
  flattenByHorizon,
  type TimelineZoom,
} from "@/lib/timeline-utils";
import { filterTree } from "@/lib/tree-filter";
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

export function GoalTimelineView() {
  const timelineZoom = useUIStore((s) => s.timelineZoom);
  const setTimelineZoom = useUIStore((s) => s.setTimelineZoom);
  const timelineYear = useUIStore((s) => s.timelineYear);
  const setTimelineYear = useUIStore((s) => s.setTimelineYear);
  const activeFilters = useUIStore((s) => s.activeFilters);
  const selectGoal = useUIStore((s) => s.selectGoal);

  const { data: tree, isLoading } = useGoalTree();

  const filteredTree = filterTree(tree ?? [], activeFilters);
  const segments = getTimeSegments(timelineYear, timelineZoom);
  const goalsByHorizon = flattenByHorizon(filteredTree);

  const minColWidth = getMinWidth(timelineZoom);
  const gridCols = `8rem repeat(${segments.length}, minmax(${minColWidth}, 1fr))`;

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
      ) : (
        <div
          className="overflow-x-auto rounded-lg border"
          style={{ scrollSnapType: "x mandatory" }}
        >
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
                    }}
                  >
                    {goalsInLane.length === 0 && (
                      <div className="col-span-full flex items-center justify-center py-4 text-xs text-muted-foreground/40">
                        No {horizonLabel.toLowerCase()} goals
                      </div>
                    )}
                    {goalsInLane.length > 0 &&
                      goalsInLane.map((goal) => {
                        const cols = getGoalColumns(goal, segments, timelineYear);
                        if (!cols) return null;
                        return (
                          <div
                            key={goal.id}
                            style={{ gridColumn: `${cols.start} / ${cols.end}` }}
                            className="m-0.5 rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-xs font-medium truncate cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={() => selectGoal(goal.id)}
                            title={goal.title}
                          >
                            {goal.category && (
                              <span
                                className="inline-block size-1.5 rounded-full mr-1"
                                style={{ backgroundColor: goal.category.color }}
                              />
                            )}
                            {goal.title}
                          </div>
                        );
                      })}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state: no goals at all */}
      {!isLoading && (tree ?? []).length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GanttChart className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">No goals in timeline</p>
        </div>
      )}

      {/* Empty state: no goals match filters */}
      {!isLoading && (tree ?? []).length > 0 && filteredTree.length === 0 && (
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
