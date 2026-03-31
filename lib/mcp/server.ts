import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./schemas.js";
import { handleGoalTool } from "./tools/goal-tools.js";

const GOAL_TOOL_NAMES = new Set([
  "create_goal",
  "get_goal",
  "update_goal",
  "delete_goal",
  "list_goals",
  "search_goals",
]);

/**
 * Create an MCP Server instance scoped to a specific user.
 *
 * Uses the low-level Server class with raw JSON Schema tool definitions
 * to avoid Zod v3/v4 type issues with the high-level McpServer API.
 * Runtime validation happens inside each tool handler using Zod v4.
 */
export function createAscendMcpServer(userId: string): Server {
  const server = new Server(
    { name: "ascend", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  // Return all tool definitions for tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // Route tools/call to the appropriate handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (GOAL_TOOL_NAMES.has(name)) {
      return handleGoalTool(userId, name, args ?? {});
    }

    // Subsequent plans will add handlers for progress, category,
    // dashboard, bulk, data, and settings tools.
    return {
      content: [{ type: "text" as const, text: "Tool not yet implemented" }],
      isError: true,
    };
  });

  return server;
}
