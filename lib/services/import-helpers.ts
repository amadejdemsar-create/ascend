/**
 * Shared import helpers for data format detection and migration.
 * Used by both the MCP data tools and the /api/import endpoint.
 */

import { goalService } from "@/lib/services/goal-service";
import { categoryService } from "@/lib/services/category-service";
import type {
  CreateGoalInput,
  ImportData,
  ImportCategoryEntry,
  ImportGoalEntry,
} from "@/lib/validations";

export const HORIZON_ORDER = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;
type Horizon = typeof HORIZON_ORDER[number];
type PriorityKey = "LOW" | "MEDIUM" | "HIGH";

const VALID_HORIZONS: readonly Horizon[] = HORIZON_ORDER;
const VALID_PRIORITIES: readonly PriorityKey[] = ["LOW", "MEDIUM", "HIGH"];

/**
 * Detect whether a parsed import payload uses the legacy todos.json format.
 * Legacy format has "tasks" or "projects" at the top level instead of
 * "goals" and "categories".
 */
export function isOldTodosFormat(data: ImportData): boolean {
  return (
    Array.isArray(data.tasks) ||
    Array.isArray(data.projects) ||
    (data.todos !== undefined && !data.goals)
  );
}

/**
 * Convert legacy todos.json format to the canonical import format.
 */
export function migrateOldFormat(data: ImportData): {
  goals: ImportGoalEntry[];
  categories: ImportCategoryEntry[];
} {
  const categories: ImportCategoryEntry[] = [];
  const goals: ImportGoalEntry[] = [];

  const projects = data.projects ?? data.categories ?? [];
  for (const project of projects) {
    categories.push({
      id: project.id ?? project.name,
      name: project.name ?? project.title ?? "Unnamed",
      color: project.color ?? "#4F46E5",
      icon: project.icon ?? null,
    });
  }

  const tasks = data.tasks ?? data.todos ?? [];
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

export interface ImportSummary {
  categoriesCreated: number;
  goalsCreated: number;
  errors?: string[];
}

function normalizeHorizon(raw: string | undefined): Horizon {
  const upper = (raw ?? "").toUpperCase() as Horizon;
  return VALID_HORIZONS.includes(upper) ? upper : "WEEKLY";
}

function normalizePriority(raw: string | undefined): PriorityKey {
  const upper = (raw ?? "").toUpperCase() as PriorityKey;
  return VALID_PRIORITIES.includes(upper) ? upper : "MEDIUM";
}

/**
 * Run the full import pipeline against the service layer.
 * Shared by the REST route (`app/api/import/route.ts`) and the MCP
 * `import_data` tool. Both callers must parse their untrusted input
 * through `importDataSchema` before calling this.
 */
export async function runImport(
  userId: string,
  payload: ImportData,
): Promise<ImportSummary> {
  const normalized = isOldTodosFormat(payload)
    ? migrateOldFormat(payload)
    : {
        goals: payload.goals ?? [],
        categories: payload.categories ?? [],
      };

  const errors: string[] = [];
  let categoriesCreated = 0;
  let goalsCreated = 0;
  const categoryIdMap = new Map<string, string>();
  const goalIdMap = new Map<string, string>();

  for (const cat of normalized.categories) {
    try {
      const created = await categoryService.create(userId, {
        name: cat.name ?? cat.title ?? "Unnamed",
        color: cat.color ?? "#4F46E5",
        icon: cat.icon ?? undefined,
      });
      if (cat.id !== undefined) {
        categoryIdMap.set(String(cat.id), created.id);
      }
      categoriesCreated++;
    } catch (err) {
      errors.push(
        `Category "${cat.name ?? cat.title ?? "?"}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // Sort goals by horizon so parents exist before children.
  const sortedGoals = [...normalized.goals].sort((a, b) => {
    const aIdx = HORIZON_ORDER.indexOf(normalizeHorizon(a.horizon));
    const bIdx = HORIZON_ORDER.indexOf(normalizeHorizon(b.horizon));
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  for (const goal of sortedGoals) {
    try {
      const rawCategoryId =
        goal.categoryId !== undefined && goal.categoryId !== null
          ? String(goal.categoryId)
          : undefined;
      const rawParentId =
        goal.parentId !== undefined && goal.parentId !== null
          ? String(goal.parentId)
          : undefined;

      const mappedCategoryId = rawCategoryId
        ? categoryIdMap.get(rawCategoryId)
        : undefined;
      const mappedParentId = rawParentId
        ? goalIdMap.get(rawParentId)
        : undefined;

      const goalData: CreateGoalInput = {
        title: goal.title ?? goal.name ?? "Untitled",
        horizon: normalizeHorizon(goal.horizon),
        priority: normalizePriority(goal.priority),
        description: goal.description ?? undefined,
        categoryId: mappedCategoryId,
        parentId: mappedParentId,
        notes: goal.notes ?? undefined,
        deadline: goal.deadline ?? undefined,
        startDate: goal.startDate ?? undefined,
        targetValue: goal.targetValue,
        unit: goal.unit,
        specific: goal.specific,
        measurable: goal.measurable,
        attainable: goal.attainable,
        relevant: goal.relevant,
        timely: goal.timely,
      };

      const created = await goalService.create(userId, goalData);
      if (goal.id !== undefined) {
        goalIdMap.set(String(goal.id), created.id);
      }
      goalsCreated++;
    } catch (err) {
      errors.push(
        `Goal "${goal.title ?? goal.name ?? "?"}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    categoriesCreated,
    goalsCreated,
    errors: errors.length > 0 ? errors : undefined,
  };
}
