"use client";

import { format } from "date-fns";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "Not Started", className: "text-muted-foreground" },
  IN_PROGRESS: { label: "In Progress", className: "text-blue-500" },
  COMPLETED: { label: "Completed", className: "text-green-500" },
  ABANDONED: { label: "Abandoned", className: "text-red-400" },
};

const HORIZON_LABELS: Record<string, string> = {
  YEARLY: "Yearly",
  QUARTERLY: "Quarterly",
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
};

interface GoalCardGoal {
  id: string;
  title: string;
  status: string;
  horizon: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  progress: number;
  deadline?: string | null;
  _depth?: number;
  children?: Array<{ id: string }>;
}

interface GoalCardProps {
  goal: GoalCardGoal;
  onSelect: (id: string) => void;
  isSelected: boolean;
}

export function GoalCard({ goal, onSelect, isSelected }: GoalCardProps) {
  const statusInfo = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.NOT_STARTED;
  const childCount = goal.children?.length ?? 0;
  const depth = goal._depth ?? 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(goal.id)}
      style={depth > 0 ? { marginLeft: `${depth * 1.25}rem` } : undefined}
      className={cn(
        "w-full rounded-lg border bg-card p-3 text-left transition-all hover:shadow-sm hover-lift",
        isSelected
          ? "ring-2 ring-primary border-primary"
          : "border-border hover:border-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-tight line-clamp-1 flex-1">
          {goal.title}
        </h3>
        <GoalPriorityBadge priority={goal.priority} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="ghost" className="text-[0.65rem] px-1.5 py-0">
          {HORIZON_LABELS[goal.horizon] ?? goal.horizon}
        </Badge>
        <span className={cn("text-xs", statusInfo.className)}>
          {statusInfo.label}
        </span>
      </div>

      {goal.progress > 0 && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out progress-bar-animated"
            style={{ width: `${Math.min(goal.progress, 100)}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {goal.deadline && (
          <span>{format(new Date(goal.deadline), "MMM d, yyyy")}</span>
        )}
        {childCount > 0 && (
          <span>
            {childCount} sub-goal{childCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}
