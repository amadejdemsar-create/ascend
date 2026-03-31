"use client";

import { Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import type { WeeklyFocusGoal } from "@/lib/services/dashboard-service";

interface WeeklyFocusWidgetProps {
  goals: WeeklyFocusGoal[];
}

export function WeeklyFocusWidget({ goals }: WeeklyFocusWidgetProps) {
  const display = goals.slice(0, 5);

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
          <p className="text-sm text-muted-foreground">
            No weekly goals set. Create one from the Goals page to stay focused.
          </p>
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
