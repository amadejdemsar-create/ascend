import { contextService } from "@/lib/services/context-service";
import {
  createContextSchema,
  updateContextSchema,
  contextFiltersSchema,
  contextSearchSchema,
  type ContextSearchMode,
} from "@/lib/validations";
import { ZodError } from "zod";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Handle all context-related MCP tool calls.
 * Validates args with Zod, delegates to the context service layer,
 * and returns MCP-formatted text content.
 */
export async function handleContextTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "set_context": {
        if (args.id && typeof args.id === "string") {
          // Update existing entry
          const { id, ...rest } = args;
          const data = updateContextSchema.parse(rest);
          const entry = await contextService.update(userId, id, data);
          return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
        }
        // Create new entry
        const data = createContextSchema.parse(args);
        const entry = await contextService.create(userId, data);
        return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
      }

      case "get_context": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        const entry = await contextService.getById(userId, id);
        if (!entry) {
          return {
            content: [{ type: "text", text: `Context entry not found: ${id}` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
      }

      case "list_context": {
        const filters = contextFiltersSchema.parse(args);
        const entries = await contextService.list(userId, filters);
        // Truncate content to 200 chars for overview
        const overview = entries.map((e: Record<string, unknown>) => ({
          ...e,
          content:
            typeof e.content === "string" && e.content.length > 200
              ? e.content.substring(0, 200) + "..."
              : e.content,
        }));
        return { content: [{ type: "text", text: JSON.stringify(overview, null, 2) }] };
      }

      case "search_context": {
        // MCP schema uses "query" but internal schema uses "q"
        const parsed = contextSearchSchema.parse({
          q: args.query,
          mode: args.mode ?? "hybrid",
          limit: args.limit ?? 20,
        });
        const results = await contextService.search(userId, parsed.q, {
          mode: parsed.mode as ContextSearchMode,
          limit: parsed.limit,
        });
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      case "delete_context": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        await contextService.delete(userId, id);
        return { content: [{ type: "text", text: `Deleted context entry: ${id}` }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown context tool: ${name}` }],
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
