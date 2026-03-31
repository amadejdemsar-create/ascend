import { goalService } from "@/lib/services/goal-service";
import { categoryService } from "@/lib/services/category-service";
import type { CreateGoalInput } from "@/lib/validations";

type McpContent = { content: Array<{ type: "text"; text: string }> };

const HORIZON_ORDER = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;

/**
 * Escape a value for CSV output. Wraps in double quotes if the value
 * contains commas, double quotes, or newlines. Internal double quotes
 * are escaped by doubling them.
 */
function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format goals as CSV with headers.
 */
function formatCSV(goals: Array<Record<string, unknown>>): string {
  const headers = [
    "id",
    "title",
    "horizon",
    "status",
    "priority",
    "progress",
    "targetValue",
    "currentValue",
    "unit",
    "deadline",
    "categoryId",
    "parentId",
    "createdAt",
  ];
  const rows = goals.map((g) => headers.map((h) => csvEscape(g[h])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

/**
 * Format goals as a Markdown document grouped by horizon.
 */
function formatMarkdown(goals: Array<Record<string, unknown>>): string {
  const date = new Date().toISOString();
  let md = `# Ascend Goal Export\n\n*Exported: ${date}*\n\n`;

  for (const horizon of HORIZON_ORDER) {
    const filtered = goals.filter((g) => g.horizon === horizon);
    if (filtered.length === 0) continue;
    const label = horizon.charAt(0) + horizon.slice(1).toLowerCase();
    md += `## ${label} Goals\n\n`;
    for (const g of filtered) {
      const checked = g.status === "COMPLETED" ? "x" : " ";
      const progress = g.progress ?? 0;
      md += `- [${checked}] **${g.title}** (${g.priority}) ${progress}%\n`;
    }
    md += "\n";
  }

  return md;
}

/**
 * Detect whether a parsed JSON object uses the old todos.json format.
 * Old format typically has "tasks" or "projects" at the top level
 * instead of "goals" and "categories".
 */
function isOldTodosFormat(data: Record<string, unknown>): boolean {
  return (
    Array.isArray(data.tasks) ||
    Array.isArray(data.projects) ||
    (data.todos !== undefined && !data.goals)
  );
}

/**
 * Convert old todos.json format to the standard import format.
 */
function migrateOldFormat(data: Record<string, unknown>): {
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

/**
 * Handle all data-related MCP tool calls: export, import, and settings.
 */
export async function handleDataTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "export_data": {
        const format = ((args.format as string) ?? "JSON").toUpperCase();
        const [goals, categories] = await Promise.all([
          goalService.list(userId),
          categoryService.list(userId),
        ]);

        let output: string;
        if (format === "CSV") {
          output = formatCSV(goals as unknown as Array<Record<string, unknown>>);
        } else if (format === "MARKDOWN") {
          output = formatMarkdown(goals as unknown as Array<Record<string, unknown>>);
        } else {
          output = JSON.stringify(
            { exportedAt: new Date().toISOString(), goals, categories },
            null,
            2,
          );
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "import_data": {
        const dataStr = args.data as string;
        if (!dataStr || typeof dataStr !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "data is required and must be a JSON string" }) }],
          };
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Invalid JSON string" }) }],
          };
        }

        // Detect and migrate old format
        let importData: {
          goals: Array<Record<string, unknown>>;
          categories: Array<Record<string, unknown>>;
        };

        if (isOldTodosFormat(parsed)) {
          importData = migrateOldFormat(parsed);
        } else {
          importData = {
            goals: (parsed.goals ?? []) as Array<Record<string, unknown>>,
            categories: (parsed.categories ?? []) as Array<Record<string, unknown>>,
          };
        }

        const errors: string[] = [];
        let categoriesCreated = 0;
        let goalsCreated = 0;
        const categoryIdMap = new Map<string, string>();
        const goalIdMap = new Map<string, string>();

        // Import categories first
        for (const cat of importData.categories) {
          try {
            const created = await categoryService.create(userId, {
              name: String(cat.name),
              color: (cat.color as string) ?? "#4F46E5",
              icon: cat.icon as string | undefined,
            });
            if (cat.id) {
              categoryIdMap.set(String(cat.id), created.id);
            }
            categoriesCreated++;
          } catch (err) {
            errors.push(`Category "${cat.name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // Sort goals by horizon so parents exist before children
        const sortedGoals = [...importData.goals].sort((a, b) => {
          const aIdx = HORIZON_ORDER.indexOf(a.horizon as typeof HORIZON_ORDER[number]);
          const bIdx = HORIZON_ORDER.indexOf(b.horizon as typeof HORIZON_ORDER[number]);
          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        });

        // Import goals
        for (const goal of sortedGoals) {
          try {
            const mappedCategoryId = goal.categoryId
              ? categoryIdMap.get(String(goal.categoryId)) ?? undefined
              : undefined;
            const mappedParentId = goal.parentId
              ? goalIdMap.get(String(goal.parentId)) ?? undefined
              : undefined;

            const goalData: CreateGoalInput = {
              title: String(goal.title ?? "Untitled"),
              horizon: (goal.horizon as "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY") ?? "WEEKLY",
              priority: (goal.priority as "LOW" | "MEDIUM" | "HIGH") ?? "MEDIUM",
              description: goal.description as string | undefined,
              categoryId: mappedCategoryId,
              parentId: mappedParentId,
              notes: goal.notes as string | undefined,
              deadline: goal.deadline as string | undefined,
              startDate: goal.startDate as string | undefined,
              targetValue: goal.targetValue as number | undefined,
              unit: goal.unit as string | undefined,
              specific: goal.specific as string | undefined,
              measurable: goal.measurable as string | undefined,
              attainable: goal.attainable as string | undefined,
              relevant: goal.relevant as string | undefined,
              timely: goal.timely as string | undefined,
            };

            const created = await goalService.create(userId, goalData);
            if (goal.id) {
              goalIdMap.set(String(goal.id), created.id);
            }
            goalsCreated++;
          } catch (err) {
            errors.push(`Goal "${goal.title}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        const summary = {
          categoriesCreated,
          goalsCreated,
          errors: errors.length > 0 ? errors : undefined,
        };

        const resultText =
          `Imported ${categoriesCreated} categories and ${goalsCreated} goals.\n\nDetails:\n` +
          JSON.stringify(summary, null, 2);

        return { content: [{ type: "text", text: resultText }] };
      }

      case "get_settings": {
        const settings = {
          theme: "system",
          defaultView: "list",
          apiKeyConfigured: true,
        };
        const text = `## Settings\n\n${JSON.stringify(settings, null, 2)}`;
        return { content: [{ type: "text", text }] };
      }

      case "update_settings": {
        const text =
          "Settings update acknowledged. Note: Server-side settings persistence will be available in a future update. Current settings are managed client-side.\n\nRequested changes:\n" +
          JSON.stringify(args, null, 2);
        return { content: [{ type: "text", text }] };
      }

      default:
        throw new Error(`Unknown data tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    };
  }
}
