"use client";

import { format } from "date-fns";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { useUIStore, type BoardGroupBy } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import type { GoalListItem } from "@/components/goals/goal-list-columns";

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

interface GoalBoardCardProps {
  goal: GoalListItem;
  isSelected: boolean;
  groupBy: BoardGroupBy;
}

export function GoalBoardCard({ goal, isSelected, groupBy }: GoalBoardCardProps) {
  const selectGoal = useUIStore((s) => s.selectGoal);

  return (
    <button
      type="button"
      onClick={() => selectGoal(goal.id)}
      className={cn(
        "w-full rounded-lg border bg-card p-2.5 text-left transition-all hover:shadow-sm",
        isSelected
          ? "ring-2 ring-primary border-primary"
          : "border-border hover:border-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <h4 className="text-sm font-medium leading-tight line-clamp-2 flex-1">
          {goal.title}
        </h4>
        <GoalPriorityBadge priority={goal.priority} />
      </div>

      {/* Show status label only when not grouped by status */}
      {groupBy !== "status" && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {STATUS_LABELS[goal.status] ?? goal.status}
        </p>
      )}

      {goal.progress > 0 && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(goal.progress, 100)}%` }}
          />
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        {goal.deadline && (
          <span>{format(new Date(goal.deadline), "MMM d")}</span>
        )}
        {goal.category && (
          <span className="flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: goal.category.color }}
            />
            {goal.category.name}
          </span>
        )}
      </div>
    </button>
  );
}
