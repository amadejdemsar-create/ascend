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
  children: ChildGoal[];
  parentHorizon: string;
  onSelectGoal: (id: string) => void;
}

function getChildHorizon(parentHorizon: string): string | null {
  const idx = HORIZON_ORDER.indexOf(parentHorizon as (typeof HORIZON_ORDER)[number]);
  if (idx < 0 || idx >= HORIZON_ORDER.length - 1) return null;
  return HORIZON_ORDER[idx + 1];
}

export function ChildrenList({
  children,
  parentHorizon,
  onSelectGoal,
}: ChildrenListProps) {
  const { openGoalModal } = useUIStore();
  const childHorizon = getChildHorizon(parentHorizon);

  return (
    <div className="space-y-2">
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sub-goals yet.</p>
      ) : (
        <ul className="space-y-1">
          {children.map((child) => (
            <li key={child.id}>
              <button
                type="button"
                onClick={() => onSelectGoal(child.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <span className="flex-1 truncate">{child.title}</span>
                <GoalPriorityBadge priority={child.priority} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {STATUS_LABELS[child.status] ?? child.status}
                </span>
                {child.progress > 0 && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {child.progress}%
                  </span>
                )}
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
