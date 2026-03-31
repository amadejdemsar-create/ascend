import { goalService } from "@/lib/services/goal-service";

type McpContent = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

/**
 * Handle bulk operation MCP tool calls: complete_goals, move_goal.
 * Validates args, delegates to the service layer,
 * and returns MCP-formatted text content.
 */
export async function handleBulkTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "complete_goals": {
        const ids = args.ids as string[];
        if (!Array.isArray(ids) || ids.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "ids is required and must be a non-empty array of strings" }) }],
            isError: true,
          };
        }

        const succeeded: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];

        for (const id of ids) {
          try {
            await goalService.update(userId, id, { status: "COMPLETED" });
            succeeded.push(id);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failed.push({ id, error: message });
          }
        }

        const text = `Completed ${succeeded.length}/${ids.length} goals.${failed.length > 0 ? "\nFailed: " + JSON.stringify(failed) : ""}`;
        return { content: [{ type: "text", text }] };
      }

      case "move_goal": {
        const id = args.id as string;
        if (!id || typeof id !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "id is required and must be a non-empty string" }) }],
            isError: true,
          };
        }

        const updatePayload: Record<string, unknown> = {};
        if ("horizon" in args && args.horizon !== undefined) {
          updatePayload.horizon = args.horizon;
        }
        if ("parentId" in args) {
          updatePayload.parentId = args.parentId ?? null;
        }

        const result = await goalService.update(userId, id, updatePayload);
        const text = `Goal moved successfully.\n\n${JSON.stringify(result, null, 2)}`;
        return { content: [{ type: "text", text }] };
      }

      default:
        throw new Error(`Unknown bulk tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
}
