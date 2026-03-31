"use client";

import React, { useState } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import { ChevronDown, ExternalLink, CheckCircle2 } from "lucide-react";
import type { TimelineGoal } from "@/lib/timeline-utils";

interface GoalTimelineNodeProps {
  goal: TimelineGoal;
  gridColumn: string;
  hasDates: boolean;
}

function GoalTimelineNodeComponent({
  goal,
  gridColumn,
  hasDates,
}: GoalTimelineNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const selectGoal = useUIStore((s) => s.selectGoal);
  const selectedGoalId = useUIStore((s) => s.selectedGoalId);

  const isSelected = selectedGoalId === goal.id;
  const isCompleted = goal.status === "COMPLETED";
  const isAbandoned = goal.status === "ABANDONED";
  const categoryColor = goal.category?.color ?? "#6B7280";
  const borderStyle = hasDates ? "border-solid" : "border-dashed";
  const opacity = isAbandoned ? "opacity-50" : "";

  return (
    <div
      style={{ gridColumn }}
      className={cn("m-0.5 relative", expanded && "z-10")}
    >
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                borderStyle,
                "border",
                isSelected && "ring-2 ring-primary/40",
                isCompleted && "line-through text-muted-foreground",
                opacity,
              )}
              style={{
                backgroundColor: `${categoryColor}15`,
                borderColor: `${categoryColor}40`,
              }}
            />
          }
        >
          <div className="flex items-center gap-1">
            {isCompleted && (
              <CheckCircle2 className="size-3 text-green-500 shrink-0" />
            )}
            {goal.category && (
              <span
                className="inline-block size-2 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor }}
              />
            )}
            <span className="truncate flex-1">{goal.title}</span>
            {goal.progress > 0 && goal.progress < 100 && (
              <div className="h-1 w-8 overflow-hidden rounded-full bg-muted shrink-0">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
                  style={{ width: `${Math.min(goal.progress, 100)}%` }}
                />
              </div>
            )}
            <ChevronDown
              className={cn(
                "size-3 shrink-0 text-muted-foreground transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className="mt-1 rounded-md border bg-popover p-2 text-xs space-y-2 shadow-md"
            style={{ borderColor: `${categoryColor}30` }}
          >
            <div className="flex items-center gap-2">
              <GoalPriorityBadge priority={goal.priority} />
              <span className="text-muted-foreground">
                {goal.status.replace("_", " ").toLowerCase()}
              </span>
            </div>
            {goal.progress > 0 && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono">{Math.round(goal.progress)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
                    style={{
                      width: `${Math.min(goal.progress, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {goal.children.length > 0 && (
              <p className="text-muted-foreground">
                {goal.children.length} sub-goal
                {goal.children.length > 1 ? "s" : ""}
              </p>
            )}
            <button
              type="button"
              className="flex items-center gap-1 text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                selectGoal(goal.id);
              }}
            >
              <ExternalLink className="size-3" />
              View details
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const GoalTimelineNode = React.memo(GoalTimelineNodeComponent);
