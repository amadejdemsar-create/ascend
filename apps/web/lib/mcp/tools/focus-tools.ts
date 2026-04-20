import { focusService } from "@/lib/services/focus-service";
import { focusSessionFiltersSchema } from "@/lib/validations";
import { ZodError } from "zod";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Handle all focus-session-related MCP tool calls.
 * Validates args with Zod, delegates to the focus service layer,
 * and returns MCP-formatted text content.
 */
export async function handleFocusTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "get_focus_sessions": {
        const filters = focusSessionFiltersSchema.parse(args);
        const result = await focusService.list(userId, filters);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown focus tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        content: [{ type: "text", text: `Validation error: ${error.message}` }],
        isError: true,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
}
