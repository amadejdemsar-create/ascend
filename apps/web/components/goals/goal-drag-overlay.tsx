"use client";

import { GoalPriorityBadge } from "./goal-priority-badge";

export interface GoalDragOverlayData {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  category: { name: string; color: string } | null;
  progress?: number;
}

export function GoalDragOverlay({ goal }: { goal: GoalDragOverlayData | null }) {
  if (!goal) return null;

  return (
    <div className="rounded-lg border-2 border-primary/40 bg-card p-2.5 shadow-xl ring-2 ring-primary/30 rotate-[2deg] max-w-[240px] pointer-events-none">
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-sm font-medium leading-tight line-clamp-2 flex-1">
          {goal.title}
        </span>
        <GoalPriorityBadge priority={goal.priority} />
      </div>
      {goal.category && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: goal.category.color }}
          />
          {goal.category.name}
        </div>
      )}
      {goal.progress != null && goal.progress > 0 && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
            style={{ width: `${Math.min(goal.progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
