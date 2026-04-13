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
import { Skeleton } from "@/components/ui/skeleton";
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

const HORIZONS = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;
const HORIZON_LABEL: Record<string, string> = {
  YEARLY: "Yearly",
  QUARTERLY: "Quarterly",
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
};
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

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
  const [horizonFilter, setHorizonFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
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

  const filtered = goals.filter((g) => {
    if (search.trim() && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (horizonFilter && g.horizon !== horizonFilter) return false;
    if (priorityFilter && g.priority !== priorityFilter) return false;
    return true;
  });

  function handlePickGoal(_goal: GoalItem) {
    onOpenChange(false);
    openGoalModal("create", "WEEKLY");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Set Weekly Focus</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Create a new weekly goal or pick an existing goal to focus on.
          </p>
        </DialogHeader>

        <Button variant="outline" className="w-full justify-start shrink-0" onClick={onCreateNew}>
          <Plus className="size-4" />
          Create new weekly goal
        </Button>

        <div className="space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search goals..."
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

          {/* Filters */}
          <div className="flex flex-wrap gap-1.5">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizonFilter(horizonFilter === h ? null : h)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  horizonFilter === h
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {HORIZON_LABEL[h]}
              </button>
            ))}
            <span className="w-px h-5 bg-border self-center" />
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(priorityFilter === p ? null : p)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  priorityFilter === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
            {(horizonFilter || priorityFilter) && (
              <button
                type="button"
                onClick={() => { setHorizonFilter(null); setPriorityFilter(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 -mx-2 px-2">
          {isLoading && (
            <div className="space-y-1 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                  <Skeleton className="size-2 shrink-0 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-14 rounded" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search || horizonFilter || priorityFilter
                ? "No goals match your filters."
                : "No active goals found."}
            </p>
          )}
          {!isLoading && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground mb-1">
              {filtered.length} goal{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
          {filtered.map((goal) => (
            <button
              key={goal.id}
              type="button"
              onClick={() => handlePickGoal(goal)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              {goal.category ? (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: goal.category.color }}
                />
              ) : (
                <span className="size-2 shrink-0 rounded-full bg-muted-foreground/20" />
              )}
              <span className="flex-1 min-w-0 truncate">{goal.title}</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
