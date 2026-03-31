import { goalService } from "@/lib/services/goal-service";
import { addProgressSchema } from "@/lib/validations";

type McpContent = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

/**
 * Handle progress-related MCP tool calls: add_progress, get_progress_history.
 * Validates args with Zod v4, delegates to the service layer,
 * and returns MCP-formatted text content.
 */
export async function handleProgressTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "add_progress": {
        const goalId = args.goalId as string;
        if (!goalId || typeof goalId !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "goalId is required and must be a non-empty string" }) }],
            isError: true,
          };
        }
        const data = addProgressSchema.parse({ value: args.value, note: args.note });
        const log = await goalService.logProgress(userId, goalId, data);
        const goal = await goalService.getById(userId, goalId);
        const unit = goal?.unit;
        const text = [
          `Progress logged: +${data.value}${unit ? " " + unit : ""}`,
          `Goal: ${goal?.title ?? "Unknown"}`,
          `Current: ${goal?.currentValue ?? 0}/${goal?.targetValue ?? "no target"} (${goal?.progress ?? 0}%)`,
          "",
          JSON.stringify(log, null, 2),
        ].join("\n");
        return { content: [{ type: "text", text }] };
      }

      case "get_progress_history": {
        const goalId = args.goalId as string;
        if (!goalId || typeof goalId !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "goalId is required and must be a non-empty string" }) }],
            isError: true,
          };
        }
        const entries = await goalService.getProgressHistory(userId, goalId);
        const text = `Progress history for goal (${entries.length} entries):\n\n${JSON.stringify(entries, null, 2)}`;
        return { content: [{ type: "text", text }] };
      }

      default:
        throw new Error(`Unknown progress tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
}
