"use client";

import { useUIStore } from "@/lib/stores/ui-store";
import { HORIZON_ORDER } from "@/lib/constants";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

interface ChildGoal {
  id: string;
  title: string;
  status: string;
  horizon: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  progress: number;
}

interface ChildrenListProps {
  goals: ChildGoal[];
  parentHorizon: string;
  onSelectGoal: (id: string) => void;
}

function getChildHorizon(parentHorizon: string): string | null {
  const idx = HORIZON_ORDER.indexOf(parentHorizon as (typeof HORIZON_ORDER)[number]);
  if (idx < 0 || idx >= HORIZON_ORDER.length - 1) return null;
  return HORIZON_ORDER[idx + 1];
}

export function ChildrenList({
  goals,
  parentHorizon,
  onSelectGoal,
}: ChildrenListProps) {
  const { openGoalModal } = useUIStore();
  const childHorizon = getChildHorizon(parentHorizon);

  return (
    <div className="space-y-2">
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sub-goals yet.</p>
      ) : (
        <ul className="space-y-1">
          {goals.map((child) => (
            <li key={child.id}>
              <button
                type="button"
                onClick={() => onSelectGoal(child.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <span className="flex-1 truncate">{child.title}</span>
                <GoalPriorityBadge priority={child.priority} />
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(child.progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-[0.6rem] font-mono text-muted-foreground w-7 text-right">
                    {child.progress}%
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {childHorizon && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openGoalModal("create", childHorizon)}
          className="w-full"
        >
          <PlusIcon className="size-3.5" />
          Add sub-goal
        </Button>
      )}
    </div>
  );
}
