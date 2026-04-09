"use client";

import { useDroppable } from "@dnd-kit/react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { GoalBoardCard } from "@/components/goals/goal-board-card";
import { useUIStore } from "@/lib/stores/ui-store";

type BoardGroupBy = "status" | "horizon" | "category";
import { cn } from "@/lib/utils";
import type { GoalListItem } from "@/components/goals/goal-list-columns";

interface GoalBoardColumnProps {
  columnKey: string;
  label: string;
  goals: GoalListItem[];
  groupBy: BoardGroupBy;
}

export function GoalBoardColumn({ columnKey, label, goals, groupBy }: GoalBoardColumnProps) {
  const selectedGoalId = useUIStore((s) => s.selectedGoalId);

  const { ref: columnRef, isDropTarget } = useDroppable({
    id: `column-${columnKey}`,
    type: "column",
    accept: "goal-card",
    collisionPriority: CollisionPriority.Low,
    data: { columnKey },
  });

  return (
    <div
      ref={columnRef}
      className={cn(
        "flex flex-col rounded-lg border bg-muted/30 overflow-hidden transition-all duration-150",
        isDropTarget && "ring-2 ring-primary/50 bg-primary/5 border-primary/30"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {goals.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        {goals.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No goals
          </p>
        )}
        {goals.map((goal, index) => (
          <GoalBoardCard
            key={goal.id}
            goal={goal}
            index={index}
            column={columnKey}
            isSelected={selectedGoalId === goal.id}
            groupBy={groupBy}
          />
        ))}
      </div>
    </div>
  );
}
