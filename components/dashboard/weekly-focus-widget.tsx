"use client";

import { useState } from "react";
import { Target, Plus, Search, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { useGoals } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import type { WeeklyFocusGoal } from "@/lib/services/dashboard-service";

interface WeeklyFocusWidgetProps {
  goals: WeeklyFocusGoal[];
}

export function WeeklyFocusWidget({ goals }: WeeklyFocusWidgetProps) {
  const display = goals.slice(0, 5);
  const [pickerOpen, setPickerOpen] = useState(false);
  const openGoalModal = useUIStore((s) => s.openGoalModal);

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
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="size-3.5" />
              Set weekly focus
            </Button>
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
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="size-3.5" />
              Add more
            </Button>
          </div>
        )}
      </CardContent>

      <WeeklyFocusPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onCreateNew={() => {
          setPickerOpen(false);
          openGoalModal("create", "WEEKLY");
        }}
      />
    </Card>
  );
}

function WeeklyFocusPicker({
  open,
  onOpenChange,
  onCreateNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data: allGoals, isLoading } = useGoals();
  const openGoalModal = useUIStore((s) => s.openGoalModal);

  interface GoalItem {
    id: string;
    title: string;
    horizon: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    status: string;
    category: { name: string; color: string } | null;
  }

  const goals = ((allGoals ?? []) as GoalItem[]).filter(
    (g) => g.status !== "COMPLETED" && g.status !== "ABANDONED"
  );

  const filtered = search.trim()
    ? goals.filter((g) => g.title.toLowerCase().includes(search.toLowerCase()))
    : goals;

  function handlePickGoal(goal: GoalItem) {
    // Create a weekly sub-goal linked to the picked goal
    onOpenChange(false);
    openGoalModal("create", "WEEKLY");
    // The modal opens with WEEKLY preset; user can set the parent manually
    // This is the simplest flow without custom API work
  }

  const HORIZON_LABEL: Record<string, string> = {
    YEARLY: "Yearly",
    QUARTERLY: "Quarterly",
    MONTHLY: "Monthly",
    WEEKLY: "Weekly",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Weekly Focus</DialogTitle>
        </DialogHeader>

        <Button variant="outline" className="w-full justify-start" onClick={onCreateNew}>
          <Plus className="size-4" />
          Create new weekly goal
        </Button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search existing goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {isLoading && (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {search ? "No goals match your search." : "No active goals found."}
            </p>
          )}
          {filtered.map((goal) => (
            <button
              key={goal.id}
              type="button"
              onClick={() => handlePickGoal(goal)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              {goal.category && (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: goal.category.color }}
                />
              )}
              <span className="flex-1 truncate">{goal.title}</span>
              <span className="text-[10px] text-muted-foreground uppercase">
                {HORIZON_LABEL[goal.horizon] ?? goal.horizon}
              </span>
              <GoalPriorityBadge priority={goal.priority} />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
