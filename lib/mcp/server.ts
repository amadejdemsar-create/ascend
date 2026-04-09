import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./schemas";
import { handleGoalTool } from "./tools/goal-tools";
import { handleProgressTool } from "./tools/progress-tools";
import { handleBulkTool } from "./tools/bulk-tools";
import { handleDashboardTool } from "./tools/dashboard-tools";
import { handleCategoryTool } from "./tools/category-tools";
import { handleDataTool } from "./tools/data-tools";
import { handleContextTool } from "./tools/context-tools";
import { handleTodoTool } from "./tools/todo-tools";
import { contextService } from "@/lib/services/context-service";
import { categoryService } from "@/lib/services/category-service";

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
const TODO_TOOLS = new Set([
  "create_todo", "get_todo", "update_todo", "delete_todo", "list_todos",
  "complete_todo", "search_todos", "get_daily_big3", "set_daily_big3", "get_todos_for_date",
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
    { capabilities: { tools: {}, resources: {} } },
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

    if (TODO_TOOLS.has(name)) {
      return handleTodoTool(userId, name, args ?? {});
    }

    // All 37 tool definitions are now routed. This fallback should never be reached.
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  });

  // ── MCP Resources: passive context browsing ──────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const categories = await categoryService.list(userId);

    const resources = [
      {
        uri: "ascend://context/all",
        name: "All Context Documents",
        description: "All context documents for this user",
        mimeType: "application/json",
      },
      {
        uri: "ascend://context/current-priorities",
        name: "Current Priorities",
        description: "Auto-derived current priorities from active goals and today's Big 3",
        mimeType: "text/markdown",
      },
      ...categories.map((cat: { id: string; name: string }) => ({
        uri: `ascend://context/category/${cat.id}`,
        name: `Context: ${cat.name}`,
        description: `Context documents in the ${cat.name} category`,
        mimeType: "application/json",
      })),
    ];

    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "ascend://context/all") {
      const entries = await contextService.list(userId);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(entries, null, 2),
        }],
      };
    }

    if (uri === "ascend://context/current-priorities") {
      // getCurrentPriorities is added by Plan 16-02; gracefully handle if not yet available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const svc = contextService as any;
      try {
        if (typeof svc.getCurrentPriorities === "function") {
          const priorities = await svc.getCurrentPriorities(userId);
          return {
            contents: [{
              uri,
              mimeType: "text/markdown",
              text: priorities.content,
            }],
          };
        }
      } catch {
        // Method not yet implemented or errored
      }
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: "Current Priorities feature not yet available. Complete Plan 16-02 to enable.",
        }],
      };
    }

    const categoryMatch = uri.match(/^ascend:\/\/context\/category\/(.+)$/);
    if (categoryMatch) {
      const categoryId = categoryMatch[1];
      const entries = await contextService.list(userId, { categoryId });
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(entries, null, 2),
        }],
      };
    }

    return {
      contents: [{
        uri,
        mimeType: "text/plain",
        text: `Unknown resource: ${uri}`,
      }],
    };
  });

  return server;
}
