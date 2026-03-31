"use client";

import { useGoalTree } from "@/lib/hooks/use-goals";
import type { TreeGoal } from "@/lib/hooks/use-goals";
import { useUIStore, type ActiveFilters } from "@/lib/stores/ui-store";
import { GoalTreeNode } from "@/components/goals/goal-tree-node";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, SearchX } from "lucide-react";

/**
 * Check whether a single goal node matches ALL active filters.
 */
function nodeMatches(goal: TreeGoal, filters: ActiveFilters): boolean {
  if (filters.horizon && goal.horizon !== filters.horizon) return false;
  if (filters.status && goal.status !== filters.status) return false;
  if (filters.priority && goal.priority !== filters.priority) return false;
  if (filters.categoryId && goal.category?.id !== filters.categoryId) return false;
  return true;
}

/**
 * Recursively prune a tree, keeping nodes that match or have matching descendants.
 * Ancestor nodes are preserved (with pruned children) to maintain hierarchy context.
 */
function filterTree(goals: TreeGoal[], filters: ActiveFilters): TreeGoal[] {
  const hasActiveFilter =
    filters.horizon || filters.status || filters.priority || filters.categoryId;
  if (!hasActiveFilter) return goals;

  return goals.reduce<TreeGoal[]>((acc, goal) => {
    const filteredChildren = filterTree(goal.children, filters);
    const selfMatches = nodeMatches(goal, filters);

    if (selfMatches || filteredChildren.length > 0) {
      acc.push({ ...goal, children: filteredChildren });
    }
    return acc;
  }, []);
}

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
