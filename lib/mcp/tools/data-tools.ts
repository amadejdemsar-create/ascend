import { goalService } from "@/lib/services/goal-service";
import { categoryService } from "@/lib/services/category-service";
import { runImport } from "@/lib/services/import-helpers";
import { formatCSV, formatMarkdown } from "@/lib/services/export-helpers";
import { importDataSchema } from "@/lib/validations";
import { ZodError } from "zod";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

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
          output = formatCSV(goals);
        } else if (format === "MARKDOWN") {
          output = formatMarkdown(goals);
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
        const dataStr = args.data;
        if (typeof dataStr !== "string" || dataStr.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "data is required and must be a JSON string",
                }),
              },
            ],
            isError: true,
          };
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Invalid JSON string" }) }],
            isError: true,
          };
        }

        const payload = importDataSchema.parse(parsed);
        const summary = await runImport(userId, payload);

        const resultText =
          `Imported ${summary.categoriesCreated} categories and ${summary.goalsCreated} goals.\n\nDetails:\n` +
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
        return {
          content: [{ type: "text", text: `Unknown data tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Validation error", details: error.issues }),
          },
        ],
        isError: true,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
}
