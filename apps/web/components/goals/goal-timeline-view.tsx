"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useGoalTree } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  getTimeSegments,
  flattenTree,
  type TimelineZoom,
} from "@/lib/timeline-utils";
import { filterTree } from "@/lib/tree-filter";
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
        left: `calc(240px + (100% - 240px) * ${todayPercent / 100})`,
      }}
    />
  );
}

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const filteredTree = useMemo(
    () => filterTree(tree ?? [], activeFilters),
    [tree, activeFilters],
  );
  const segments = getTimeSegments(timelineYear, timelineZoom, timelineMonth);

  // Expand/collapse: default first two levels open
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const g of tree ?? []) {
      ids.add(g.id);
      for (const c of g.children) {
        ids.add(c.id);
      }
    }
    return ids;
  });

  // Re-initialize expanded IDs when tree data loads for the first time
  const treeLoadedRef = useRef(false);
  useEffect(() => {
    if (tree && tree.length > 0 && !treeLoadedRef.current) {
      treeLoadedRef.current = true;
      const ids = new Set<string>();
      for (const g of tree) {
        ids.add(g.id);
        for (const c of g.children) {
          ids.add(c.id);
        }
      }
      setExpandedIds(ids);
    }
  }, [tree]);

  const flatRows = useMemo(
    () => flattenTree(filteredTree, expandedIds),
    [filteredTree, expandedIds],
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const minColWidth = getMinWidth(timelineZoom);
  const gridCols = `240px repeat(${segments.length}, minmax(${minColWidth}, 1fr))`;
  const mobileGridCols = `0px repeat(${segments.length}, minmax(${minColWidth}, 1fr))`;

  // Auto-scroll to today on mount when viewing current year at month zoom
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const todayPercent = computeTodayPercent(timelineYear);
    if (todayPercent === null) return;
    if (timelineZoom !== "month") return;

    const scrollWidth = container.scrollWidth;
    const containerWidth = container.clientWidth;
    const labelWidth = 240;
    const timelineWidth = scrollWidth - labelWidth;
    const todayScrollPos = labelWidth + (todayPercent / 100) * timelineWidth;
    container.scrollTo({
      left: todayScrollPos - containerWidth / 2,
      behavior: "smooth",
    });
  }, [timelineYear, timelineZoom]);

  const hasGoals = (tree ?? []).length > 0;
  const hasFilteredGoals = flatRows.length > 0;

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-3">
        {/* Period navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={timelineZoom === "month" ? "Previous month" : "Previous year"}
            onClick={() => {
              if (timelineZoom === "month") {
                if (timelineMonth === 0) {
                  setTimelineYear(timelineYear - 1);
                  setTimelineMonth(11);
                } else {
                  setTimelineMonth(timelineMonth - 1);
                }
              } else {
                setTimelineYear(timelineYear - 1);
              }
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-mono text-sm font-semibold min-w-[5rem] text-center">
            {timelineZoom === "month"
              ? new Date(timelineYear, timelineMonth).toLocaleDateString("en", {
                  month: "short",
                  year: "numeric",
                })
              : timelineYear}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={timelineZoom === "month" ? "Next month" : "Next year"}
            onClick={() => {
              if (timelineZoom === "month") {
                if (timelineMonth === 11) {
                  setTimelineYear(timelineYear + 1);
                  setTimelineMonth(0);
                } else {
                  setTimelineMonth(timelineMonth + 1);
                }
              } else {
                setTimelineYear(timelineYear + 1);
              }
            }}
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
          className="overflow-auto rounded-lg border relative"
          style={{ maxHeight: "calc(100vh - 220px)" }}
        >
          {/* Today marker overlay */}
          <TodayMarker timelineYear={timelineYear} />

          <div
            style={{ display: "grid", gridTemplateColumns: gridCols }}
            className="min-w-fit md:grid"
          >
            {/* Mobile grid override */}
            <style>{`
              @media (max-width: 767px) {
                [data-timeline-grid] {
                  grid-template-columns: ${mobileGridCols} !important;
                }
                [data-tree-cell] {
                  display: none !important;
                }
              }
            `}</style>
            <div data-timeline-grid="" style={{ display: "contents" }}>
              {/* Header row: corner cell + segment labels */}
              <div className="sticky left-0 top-0 z-30 bg-muted/80 border-b border-r px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur" data-tree-cell="">
                Goals
              </div>
              {segments.map((seg, i) => (
                <div
                  key={i}
                  className="sticky top-0 z-20 bg-muted/80 border-b px-2 py-2 text-center text-xs font-medium text-muted-foreground backdrop-blur"
                >
                  {seg.label}
                </div>
              ))}

              {/* Goal rows */}
              {flatRows.map((row) => (
                <GoalTimelineNode
                  key={row.goal.id}
                  row={row}
                  segments={segments}
                  year={timelineYear}
                  minColWidth={minColWidth}
                  onSelect={selectGoal}
                  onToggleExpand={toggleExpand}
                  isSelected={selectedGoalId === row.goal.id}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Empty state: no goals at all */}
      {!isLoading && !hasGoals && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GanttChart className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            No goals in timeline
          </p>
          <p className="mt-2 max-w-sm text-xs text-muted-foreground/70">
            Goals need a deadline to appear on the timeline. Add deadlines to
            your goals from the goal detail panel or when creating new goals.
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
