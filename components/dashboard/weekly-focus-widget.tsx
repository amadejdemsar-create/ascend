"use client";

import { useState } from "react";
import { Target, Plus, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { useGoals } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import type { WeeklyFocusGoal } from "@/lib/services/dashboard-service";

interface WeeklyFocusWidgetProps {
  goals: WeeklyFocusGoal[];
  onCreateWeekly?: () => void;
}

export function WeeklyFocusWidget({ goals, onCreateWeekly }: WeeklyFocusWidgetProps) {
  const display = goals.slice(0, 5);
  const [showPicker, setShowPicker] = useState(false);
  const router = useRouter();
  const setActiveFilters = useUIStore((s) => s.setActiveFilters);

  function handleBrowseWeekly() {
    setActiveFilters({ horizon: "WEEKLY" });
    router.push("/goals");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-4 text-muted-foreground" />
          This Week&apos;s Focus
        </CardTitle>
      </CardHeader>
      <CardContent>
        {display.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No weekly goals set.
            </p>
            <div className="flex flex-wrap gap-2">
              {onCreateWeekly && (
                <Button variant="outline" size="sm" onClick={onCreateWeekly}>
                  <Plus className="size-3.5" />
                  Create new
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleBrowseWeekly}>
                Browse goals
              </Button>
            </div>

            {/* Quick picker for existing goals */}
            <ExistingGoalsPicker
              open={showPicker}
              onToggle={() => setShowPicker(!showPicker)}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {display.map((goal) => (
              <div key={goal.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  {goal.category && (
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: goal.category.color }}
                    />
                  )}
                  <span className="flex-1 truncate text-sm">{goal.title}</span>
                  <GoalPriorityBadge
                    priority={goal.priority as "LOW" | "MEDIUM" | "HIGH"}
                  />
                </div>
                {goal.progress > 0 && (
                  <div className="ml-3.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExistingGoalsPicker({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { data: goals, isLoading } = useGoals({ horizon: "WEEKLY" });
  const selectGoal = useUIStore((s) => s.selectGoal);
  const router = useRouter();

  interface GoalItem {
    id: string;
    title: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    category: { color: string } | null;
  }

  const weeklyGoals = (goals ?? []) as GoalItem[];

  if (weeklyGoals.length === 0 && !isLoading) return null;

  function handleSelect(id: string) {
    selectGoal(id);
    router.push("/goals");
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
        Existing weekly goals ({isLoading ? "..." : weeklyGoals.length})
      </button>

      {open && !isLoading && weeklyGoals.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {weeklyGoals.slice(0, 8).map((goal) => (
            <li key={goal.id}>
              <button
                type="button"
                onClick={() => handleSelect(goal.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors text-left"
              >
                {goal.category && (
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: goal.category.color }}
                  />
                )}
                <span className="flex-1 truncate">{goal.title}</span>
                <GoalPriorityBadge priority={goal.priority} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
