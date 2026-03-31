"use client";

import { useGoalTree } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import { filterTree } from "@/lib/tree-filter";
import { GoalTreeNode } from "@/components/goals/goal-tree-node";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, SearchX } from "lucide-react";

export function GoalTreeView() {
  const { data: tree, isLoading } = useGoalTree();
  const activeFilters = useUIStore((s) => s.activeFilters);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    );
  }

  const goals = tree ?? [];
  const filteredGoals = filterTree(goals, activeFilters);

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GitBranch className="size-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm text-muted-foreground">No goals in hierarchy</p>
      </div>
    );
  }

  const hasActiveFilter =
    activeFilters.horizon ||
    activeFilters.status ||
    activeFilters.priority ||
    activeFilters.categoryId;

  if (filteredGoals.length === 0 && hasActiveFilter) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <SearchX className="size-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm text-muted-foreground">
          No goals match current filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {filteredGoals.map((goal) => (
        <GoalTreeNode key={goal.id} goal={goal} depth={0} />
      ))}
    </div>
  );
}
