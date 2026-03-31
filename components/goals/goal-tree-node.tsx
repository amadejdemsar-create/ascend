"use client";

import React, { useState } from "react";
import { ChevronRight, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import type { TreeGoal } from "@/lib/hooks/use-goals";

const HORIZON_LABELS: Record<string, string> = {
  YEARLY: "Y",
  QUARTERLY: "Q",
  MONTHLY: "M",
  WEEKLY: "W",
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

interface GoalTreeNodeProps {
  goal: TreeGoal;
  depth: number;
  index: number;
  parentId: string | null;
}

export const GoalTreeNode = React.memo(function GoalTreeNode({
  goal,
  depth,
  index,
  parentId,
}: GoalTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const selectedGoalId = useUIStore((s) => s.selectedGoalId);
  const selectGoal = useUIStore((s) => s.selectGoal);

  const { ref: sortableRef, handleRef, isDragging, isDropTarget } = useSortable({
    id: goal.id,
    index,
    type: "tree-node",
    accept: "tree-node",
    group: parentId ?? "root",
    data: { parentId },
  });

  const hasChildren = goal.children.length > 0;
  const isSelected = selectedGoalId === goal.id;

  return (
    <div ref={sortableRef} className={cn(isDragging && "opacity-30 bg-muted/30 rounded-md")}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            isSelected
              ? "bg-primary/10 ring-1 ring-primary/30"
              : "hover:bg-muted/60",
            !isDragging && isDropTarget && "bg-primary/5 border-l-2 border-l-primary"
          )}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        >
          {/* Drag handle */}
          <span
            ref={handleRef}
            className={cn(
              "inline-flex shrink-0 text-muted-foreground hover:text-foreground",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            <GripVertical className="size-3.5" />
          </span>

          {/* Expand/collapse chevron */}
          {hasChildren ? (
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
                />
              }
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  expanded && "rotate-90"
                )}
              />
            </CollapsibleTrigger>
          ) : (
            <span className="size-5 shrink-0" />
          )}

          {/* Horizon badge */}
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
            {HORIZON_LABELS[goal.horizon] ?? goal.horizon.charAt(0)}
          </span>

          {/* Clickable title */}
          <button
            type="button"
            className="flex-1 truncate text-left font-medium hover:underline"
            onClick={() => selectGoal(goal.id)}
          >
            {goal.title}
          </button>

          {/* Inline metadata */}
          <div className="flex shrink-0 items-center gap-1.5">
            {goal.category && (
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: goal.category.color }}
                title={goal.category.name}
              />
            )}

            <span className="text-xs text-muted-foreground">
              {STATUS_LABELS[goal.status] ?? goal.status}
            </span>

            <GoalPriorityBadge priority={goal.priority} />

            {goal.progress > 0 && (
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(goal.progress, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Children (animated collapse) */}
        {hasChildren && (
          <CollapsibleContent>
            {goal.children.map((child, i) => (
              <GoalTreeNode
                key={child.id}
                goal={child}
                depth={depth + 1}
                index={i}
                parentId={goal.id}
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
});
