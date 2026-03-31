"use client";

import { useMemo } from "react";
import { GoalBoardColumn } from "@/components/goals/goal-board-column";
import { useUIStore, type BoardGroupBy } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import type { GoalListItem } from "@/components/goals/goal-list-columns";

const STATUS_COLUMNS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"] as const;
const HORIZON_COLUMNS = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

const HORIZON_LABELS: Record<string, string> = {
  YEARLY: "Yearly",
  QUARTERLY: "Quarterly",
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
};

interface GoalBoardViewProps {
  goals: GoalListItem[];
}

export function GoalBoardView({ goals }: GoalBoardViewProps) {
  const boardGroupBy = useUIStore((s) => s.boardGroupBy);
  const setBoardGroupBy = useUIStore((s) => s.setBoardGroupBy);

  const columns = boardGroupBy === "status" ? STATUS_COLUMNS : HORIZON_COLUMNS;
  const labels = boardGroupBy === "status" ? STATUS_LABELS : HORIZON_LABELS;

  const grouped = useMemo(() => {
    const map = new Map<string, GoalListItem[]>();
    for (const col of columns) {
      map.set(col, []);
    }
    for (const goal of goals) {
      const key = boardGroupBy === "status" ? goal.status : goal.horizon;
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(goal);
      }
    }
    return map;
  }, [goals, boardGroupBy, columns]);

  return (
    <div className="space-y-3">
      {/* Grouping toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Group by:</span>
        <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
          {(["status", "horizon"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBoardGroupBy(option)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                boardGroupBy === option
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option === "status" ? "Status" : "Horizon"}
            </button>
          ))}
        </div>
      </div>

      {/* Column grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map((col) => (
          <GoalBoardColumn
            key={col}
            columnKey={col}
            label={labels[col] ?? col}
            goals={grouped.get(col) ?? []}
            groupBy={boardGroupBy}
          />
        ))}
      </div>
    </div>
  );
}
