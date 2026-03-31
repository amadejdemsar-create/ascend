"use client";

import { GoalBoardCard } from "@/components/goals/goal-board-card";
import { useUIStore, type BoardGroupBy } from "@/lib/stores/ui-store";
import type { GoalListItem } from "@/components/goals/goal-list-columns";

interface GoalBoardColumnProps {
  columnKey: string;
  label: string;
  goals: GoalListItem[];
  groupBy: BoardGroupBy;
}

export function GoalBoardColumn({ label, goals, groupBy }: GoalBoardColumnProps) {
  const selectedGoalId = useUIStore((s) => s.selectedGoalId);

  return (
    <div className="flex flex-col rounded-lg border bg-muted/30 overflow-hidden">
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
        {goals.map((goal) => (
          <GoalBoardCard
            key={goal.id}
            goal={goal}
            isSelected={selectedGoalId === goal.id}
            groupBy={groupBy}
          />
        ))}
      </div>
    </div>
  );
}
