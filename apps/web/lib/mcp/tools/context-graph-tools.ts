import { contextService } from "@/lib/services/context-service";
import { contextLinkService } from "@/lib/services/context-link-service";
import {
  contextEntryTypeSchema,
  createContextLinkSchema,
} from "@/lib/validations";
import { z } from "zod";
import { ZodError } from "zod";
import { CONTEXT_ENTRY_TYPE_VALUES } from "@ascend/core";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(result: unknown): McpContent {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function fail(message: string): McpContent {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Handle context graph MCP tool calls.
 *
 * Seven tools: get_context_graph, get_node_neighbors, get_related_context,
 * list_nodes_by_type, create_typed_link, remove_typed_link, update_context_type.
 *
 * Validates args with Zod, delegates to contextService / contextLinkService,
 * and returns MCP-formatted text content.
 */
export async function handleContextGraphTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "get_context_graph": {
        // MCP args come as typed objects (not query params), so define an
        // MCP-specific schema rather than reusing the HTTP query param schema
        // which uses string-to-array transforms.
        const filters = z
          .object({
            types: z.array(z.enum(CONTEXT_ENTRY_TYPE_VALUES)).optional(),
            categoryId: z.string().min(1).optional(),
            tag: z.string().min(1).optional(),
            cap: z.number().int().min(1).max(5000).optional(),
          })
          .parse(args);
        const graph = await contextService.getGraph(userId, filters);
        return ok(graph);
      }

      case "get_node_neighbors": {
        const { id, depth } = z
          .object({
            id: z.string().min(1),
            depth: z.number().int().min(1).max(3).optional().default(1),
          })
          .parse(args);
        const result = await contextService.getNeighbors(userId, id, depth);
        return ok(result);
      }

      case "get_related_context": {
        const { id } = z
          .object({
            id: z.string().min(1),
          })
          .parse(args);
        const related = await contextService.getRelated(userId, id);
        return ok(related);
      }

      case "list_nodes_by_type": {
        const { type } = z
          .object({
            type: contextEntryTypeSchema,
          })
          .parse(args);
        const nodes = await contextService.listByType(userId, type);
        return ok(nodes);
      }

      case "create_typed_link": {
        const input = createContextLinkSchema.parse(args);
        const link = await contextLinkService.create(userId, input);
        return ok(link);
      }

      case "remove_typed_link": {
        const { id, force } = z
          .object({
            id: z.string().min(1),
            force: z.boolean().optional(),
          })
          .parse(args);
        await contextLinkService.delete(userId, id, { force });
        return ok({ ok: true, id });
      }

      case "update_context_type": {
        const { id, type } = z
          .object({
            id: z.string().min(1),
            type: contextEntryTypeSchema,
          })
          .parse(args);
        const updated = await contextService.updateType(userId, id, type);
        return ok(updated);
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(`Validation error: ${JSON.stringify(error.issues)}`);
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}
