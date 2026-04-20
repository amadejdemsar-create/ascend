"use client";

import { CalendarClock, ArrowRight } from "lucide-react";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/ui-store";
import type { DeadlineGoal } from "@/lib/services/dashboard-service";

interface UpcomingDeadlinesWidgetProps {
  goals: DeadlineGoal[];
}

export function UpcomingDeadlinesWidget({
  goals,
}: UpcomingDeadlinesWidgetProps) {
  const openGoalModal = useUIStore((s) => s.openGoalModal);
  const now = new Date();
  const sevenDaysOut = addDays(now, 7);
  const twoDaysOut = addDays(now, 2);

  const next7 = goals.filter((g) => {
    const d = new Date(g.deadline);
    return isBefore(d, sevenDaysOut) || d.getTime() === sevenDaysOut.getTime();
  });

  const next7to14 = goals.filter((g) => {
    const d = new Date(g.deadline);
    return isAfter(d, sevenDaysOut);
  });

  function renderGoalRow(goal: DeadlineGoal) {
    const deadlineDate = new Date(goal.deadline);
    const isUrgent = isBefore(deadlineDate, twoDaysOut);

    return (
      <div key={goal.id} className="flex items-center gap-2">
        {goal.category && (
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: goal.category.color }}
          />
        )}
        <span className="flex-1 truncate text-sm">{goal.title}</span>
        <Badge variant="outline" className="text-[0.6rem]">
          {goal.horizon}
        </Badge>
        <span
          className={`shrink-0 text-xs ${isUrgent ? "font-medium text-destructive" : "text-muted-foreground"}`}
        >
          {format(deadlineDate, "MMM d")}
        </span>
      </div>
    );
  }

  return (
    <Card className="hover-lift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          Upcoming Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No upcoming deadlines. Your schedule is clear.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openGoalModal("create")}
            >
              Set a deadline
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {next7.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Next 7 days
                </p>
                <div className="space-y-2">{next7.map(renderGoalRow)}</div>
              </div>
            )}
            {next7to14.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  7 to 14 days
                </p>
                <div className="space-y-2">{next7to14.map(renderGoalRow)}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
