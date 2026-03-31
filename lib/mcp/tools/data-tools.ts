import { goalService } from "@/lib/services/goal-service";
import { categoryService } from "@/lib/services/category-service";
import { isOldTodosFormat, migrateOldFormat, HORIZON_ORDER } from "@/lib/services/import-helpers";
import { formatCSV, formatMarkdown } from "@/lib/services/export-helpers";
import type { CreateGoalInput } from "@/lib/validations";

type McpContent = { content: Array<{ type: "text"; text: string }> };

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
