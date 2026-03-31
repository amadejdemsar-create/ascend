"use client";

import { GoalPriorityBadge } from "./goal-priority-badge";

export interface GoalDragOverlayData {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  category: { name: string; color: string } | null;
}

export function GoalDragOverlay({ goal }: { goal: GoalDragOverlayData | null }) {
  if (!goal) return null;

  return (
    <div className="rounded-lg border bg-card p-2.5 shadow-lg ring-2 ring-primary/50 rotate-2 max-w-[240px]">
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
    </div>
  );
}
