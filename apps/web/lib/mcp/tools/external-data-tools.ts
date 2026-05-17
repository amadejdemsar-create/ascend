/**
 * Wave 10: MCP tool handlers for external data (GitHub, ...).
 *
 * Three read-only tools. Source create + delete (and PAT entry) require
 * the UI; not exposed via MCP.
 */

import { ZodError } from "zod";
import { externalDataService } from "@/lib/services/external-data-service";
import { externalDataQuerySchema } from "@/lib/validations";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export async function handleExternalDataTool(
  userId: string,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "list_external_sources": {
        const sources = await externalDataService.list(userId, workspaceId);
        return {
          content: [{ type: "text", text: JSON.stringify(sources, null, 2) }],
        };
      }
      case "query_external_data": {
        if (typeof args !== "object" || args === null) {
          throw new Error("Missing arguments");
        }
        const obj = args as { sourceId?: unknown } & Record<string, unknown>;
        if (typeof obj.sourceId !== "string") {
          throw new Error("Missing or invalid 'sourceId' argument");
        }
        const { sourceId, ...rest } = obj;
        const input = externalDataQuerySchema.parse(rest);
        const result = await externalDataService.query(
          userId,
          workspaceId,
          sourceId,
          input,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      case "refresh_external_schema": {
        if (typeof args !== "object" || args === null) {
          throw new Error("Missing arguments");
        }
        const obj = args as { sourceId?: unknown };
        if (typeof obj.sourceId !== "string") {
          throw new Error("Missing or invalid 'sourceId' argument");
        }
        const source = await externalDataService.refreshSchema(
          userId,
          workspaceId,
          obj.sourceId,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(source, null, 2) }],
        };
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
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
