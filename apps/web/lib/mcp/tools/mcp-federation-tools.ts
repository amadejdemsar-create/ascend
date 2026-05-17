/**
 * Wave 10: MCP tool handlers for federation control.
 *
 * Four read-or-state-flip tools. Connection create + delete + credential
 * entry require the UI; not exposed via MCP because PAT/credential
 * paste belongs in a browser context.
 */

import { ZodError } from "zod";
import { mcpFederationService } from "@/lib/services/mcp-federation-service";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

const idSchema = (args: unknown): string => {
  if (typeof args !== "object" || args === null) {
    throw new Error("Missing arguments");
  }
  const obj = args as { id?: unknown };
  if (typeof obj.id !== "string" || obj.id.length === 0) {
    throw new Error("Missing or invalid 'id' argument");
  }
  return obj.id;
};

export async function handleMcpFederationTool(
  userId: string,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "list_mcp_connections": {
        const result = await mcpFederationService.list(userId, workspaceId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      case "test_mcp_connection": {
        const id = idSchema(args);
        const result = await mcpFederationService.testConnection(
          userId,
          workspaceId,
          id,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }
      case "enable_mcp_connection": {
        const id = idSchema(args);
        const connection = await mcpFederationService.update(
          userId,
          workspaceId,
          id,
          { enabled: true },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(connection, null, 2) }],
        };
      }
      case "disable_mcp_connection": {
        const id = idSchema(args);
        const connection = await mcpFederationService.update(
          userId,
          workspaceId,
          id,
          { enabled: false },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(connection, null, 2) }],
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
