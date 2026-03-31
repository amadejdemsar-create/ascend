/**
 * Shared import helpers for data format detection and migration.
 * Used by both the MCP data tools and the /api/import endpoint.
 */

export const HORIZON_ORDER = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;

/**
 * Detect whether a parsed JSON object uses the old todos.json format.
 * Old format typically has "tasks" or "projects" at the top level
 * instead of "goals" and "categories".
 */
export function isOldTodosFormat(data: Record<string, unknown>): boolean {
  return (
    Array.isArray(data.tasks) ||
    Array.isArray(data.projects) ||
    (data.todos !== undefined && !data.goals)
  );
}

/**
 * Convert old todos.json format to the standard import format.
 */
export function migrateOldFormat(data: Record<string, unknown>): {
  goals: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
} {
  const categories: Array<Record<string, unknown>> = [];
  const goals: Array<Record<string, unknown>> = [];

  // Map old projects/categories
  const projects = (data.projects ?? data.categories ?? []) as Array<Record<string, unknown>>;
  for (const project of projects) {
    categories.push({
      id: project.id ?? project.name,
      name: project.name ?? project.title ?? "Unnamed",
      color: project.color ?? "#4F46E5",
      icon: project.icon ?? null,
    });
  }

  // Map old tasks to WEEKLY goals
  const tasks = (data.tasks ?? data.todos ?? []) as Array<Record<string, unknown>>;
  for (const task of tasks) {
    goals.push({
      id: task.id,
      title: task.title ?? task.name ?? "Untitled",
      horizon: task.horizon ?? "WEEKLY",
      status: task.completed ? "COMPLETED" : (task.status ?? "NOT_STARTED"),
      priority: task.priority ?? "MEDIUM",
      categoryId: task.projectId ?? task.categoryId ?? null,
      parentId: task.parentId ?? null,
      description: task.description ?? null,
      notes: task.notes ?? null,
    });
  }

  return { goals, categories };
}
