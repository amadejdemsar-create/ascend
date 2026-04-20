import type { TreeGoal } from "@/lib/hooks/use-goals";
import type { ActiveFilters } from "@/lib/stores/ui-store";

/**
 * Check whether a single goal node matches ALL active filters.
 */
export function nodeMatches(goal: TreeGoal, filters: ActiveFilters): boolean {
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
export function filterTree(goals: TreeGoal[], filters: ActiveFilters): TreeGoal[] {
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
