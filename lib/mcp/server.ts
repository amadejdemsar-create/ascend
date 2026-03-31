import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./schemas.js";
import { handleGoalTool } from "./tools/goal-tools.js";
import { handleProgressTool } from "./tools/progress-tools.js";
import { handleBulkTool } from "./tools/bulk-tools.js";
import { handleDashboardTool } from "./tools/dashboard-tools.js";

const GOAL_TOOL_NAMES = new Set([
  "create_goal",
  "get_goal",
  "update_goal",
  "delete_goal",
  "list_goals",
  "search_goals",
]);

const PROGRESS_TOOL_NAMES = new Set(["add_progress", "get_progress_history"]);
const BULK_TOOL_NAMES = new Set(["complete_goals", "move_goal"]);
const DASHBOARD_TOOLS = new Set(["get_dashboard", "get_current_priorities", "get_stats", "get_timeline"]);

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

    if (PROGRESS_TOOL_NAMES.has(name)) {
      return handleProgressTool(userId, name, args ?? {});
    }

    if (BULK_TOOL_NAMES.has(name)) {
      return handleBulkTool(userId, name, args ?? {});
    }

    if (DASHBOARD_TOOLS.has(name)) {
      return handleDashboardTool(userId, name, args ?? {});
    }

    // Subsequent plans will add handlers for category,
    // data, and settings tools.
    return {
      content: [{ type: "text" as const, text: "Tool not yet implemented" }],
      isError: true,
    };
  });

  return server;
}
