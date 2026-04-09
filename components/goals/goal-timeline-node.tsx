"use client";

import React from "react";
import {
  getGoalColumns,
  type FlatTimelineRow,
  type TimeSegment,
} from "@/lib/timeline-utils";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface GoalTimelineNodeProps {
  row: FlatTimelineRow;
  segments: TimeSegment[];
  year: number;
  minColWidth: string;
  onSelect: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  isSelected: boolean;
}

function GoalTimelineNodeComponent({
  row,
  segments,
  year,
  minColWidth,
  onSelect,
  onToggleExpand,
  isSelected,
}: GoalTimelineNodeProps) {
  const { goal, depth, hasChildren, isExpanded } = row;
  const categoryColor = goal.category?.color ?? "#6B7280";
  const isCompleted = goal.status === "COMPLETED";
  const isAbandoned = goal.status === "ABANDONED";
  const cols = getGoalColumns(goal, segments, year);
  const hasDates = !!(goal.startDate || goal.deadline);

  return (
    <React.Fragment>
      {/* Cell 1: Tree label (sticky left) */}
      <div
        data-tree-cell=""
        className={cn(
          "sticky left-0 z-10 bg-background border-b border-r flex items-center gap-1.5 py-1 text-sm cursor-pointer hover:bg-muted/60 transition-colors",
          isSelected && "bg-accent",
          isAbandoned && "opacity-50",
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.75}rem`, paddingRight: "0.5rem" }}
        onClick={() => onSelect(goal.id)}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 rounded-sm p-0.5 hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(goal.id);
            }}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform duration-150",
                isExpanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        {/* Category color dot */}
        {goal.category && (
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor }}
          />
        )}
        {/* Title */}
        <span
          className={cn(
            "truncate text-sm font-medium",
            isCompleted && "line-through text-muted-foreground",
          )}
        >
          {goal.title}
        </span>
      </div>

      {/* Cell 2: Bar area (spans all time columns) */}
      <div
        className="border-b relative"
        style={{
          gridColumn: `2 / ${segments.length + 2}`,
          display: "grid",
          gridTemplateColumns: `repeat(${segments.length}, minmax(${minColWidth}, 1fr))`,
        }}
      >
        {cols ? (
          <button
            type="button"
            className={cn(
              "relative h-6 my-1 rounded px-1.5 text-[11px] font-medium truncate text-left transition-colors hover:brightness-110 overflow-hidden",
              !hasDates && "border border-dashed",
              isCompleted && "line-through text-muted-foreground",
              isAbandoned && "opacity-50",
              isSelected && "ring-2 ring-primary/40",
            )}
            style={{
              gridColumn: `${cols.start} / ${cols.end}`,
              backgroundColor: `${categoryColor}20`,
              borderLeft: `3px solid ${categoryColor}`,
              borderColor: !hasDates ? `${categoryColor}60` : undefined,
              minWidth: "2rem",
            }}
            onClick={() => onSelect(goal.id)}
          >
            {/* Progress fill overlay */}
            {goal.progress > 0 && (
              <div
                className="absolute inset-0 rounded-r-none"
                style={{
                  width: `${Math.min(goal.progress, 100)}%`,
                  backgroundColor: `${categoryColor}20`,
                }}
              />
            )}
            <span className="relative z-[1]">{goal.title}</span>
          </button>
        ) : (
          <div className="h-8" style={{ gridColumn: `1 / ${segments.length + 1}` }} />
        )}
      </div>
    </React.Fragment>
  );
}

export const GoalTimelineNode = React.memo(GoalTimelineNodeComponent);
