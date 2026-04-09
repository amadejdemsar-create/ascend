import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./schemas";
import { handleGoalTool } from "./tools/goal-tools";
import { handleProgressTool } from "./tools/progress-tools";
import { handleBulkTool } from "./tools/bulk-tools";
import { handleDashboardTool } from "./tools/dashboard-tools";
import { handleCategoryTool } from "./tools/category-tools";
import { handleDataTool } from "./tools/data-tools";
import { handleContextTool } from "./tools/context-tools";

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
const CATEGORY_TOOLS = new Set(["create_category", "update_category", "delete_category", "list_categories"]);
const DATA_TOOLS = new Set(["export_data", "import_data", "get_settings", "update_settings"]);
const CONTEXT_TOOLS = new Set([
  "set_context", "get_context", "list_context", "search_context", "delete_context",
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

    if (PROGRESS_TOOL_NAMES.has(name)) {
      return handleProgressTool(userId, name, args ?? {});
    }

    if (BULK_TOOL_NAMES.has(name)) {
      return handleBulkTool(userId, name, args ?? {});
    }

    if (DASHBOARD_TOOLS.has(name)) {
      return handleDashboardTool(userId, name, args ?? {});
    }

    if (CATEGORY_TOOLS.has(name)) {
      return handleCategoryTool(userId, name, args ?? {});
    }

    if (DATA_TOOLS.has(name)) {
      return handleDataTool(userId, name, args ?? {});
    }

    if (CONTEXT_TOOLS.has(name)) {
      return handleContextTool(userId, name, args ?? {});
    }

    // All 27 tool definitions are now routed. This fallback should never be reached.
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  });

  return server;
}
