---
description: MCP tool implementation patterns for the Ascend MCP server
globs: lib/mcp/**
---

# MCP Tool Patterns

## Overview

Ascend exposes 37 MCP tools via Streamable HTTP at `/api/mcp`. The server uses the low-level `Server` class from `@modelcontextprotocol/sdk` with raw JSON Schema tool definitions (not Zod) because of Zod v3/v4 type incompatibilities with the high-level McpServer API. Runtime validation of arguments happens inside handlers using Zod v4 schemas from `lib/validations.ts`.

## Adding a New Tool

### Step 1: Define the JSON Schema in `lib/mcp/schemas.ts`

```typescript
// Add to the TOOL_DEFINITIONS array
{
  name: "my_new_tool",
  description: "Clear description of what this tool does and when to use it.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The ID of the item" },
      title: { type: "string", description: "Title (1 to 200 chars)" },
      priority: {
        type: "string",
        enum: PRIORITY_ENUM,
        description: "Priority level (defaults to MEDIUM)",
      },
    },
    required: ["id"],
  },
},
```

Use the existing enum constants: `HORIZON_ENUM`, `STATUS_ENUM`, `PRIORITY_ENUM`, `TODO_STATUS_ENUM`.

### Step 2: Add the handler in `lib/mcp/tools/<domain>-tools.ts`

```typescript
import { someService } from "@/lib/services/some-service";
import { someSchema } from "@/lib/validations";
import { ZodError } from "zod";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export async function handleSomeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "my_new_tool": {
        const data = someSchema.parse(args);  // Zod runtime validation
        const result = await someService.method(userId, data);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
```

### Step 3: Register in `lib/mcp/server.ts`

Add the tool name to the appropriate Set (or create a new one):

```typescript
const MY_NEW_TOOLS = new Set(["my_new_tool", "my_other_tool"]);
```

Add routing in the `CallToolRequestSchema` handler:

```typescript
if (MY_NEW_TOOLS.has(name)) {
  return handleSomeTool(userId, name, args ?? {});
}
```

## Rules

1. **Always call the service layer.** MCP handlers never import Prisma directly. They call services from `lib/services/`.

2. **McpContent return type.** Every handler returns `{ content: [{ type: "text", text: string }], isError?: boolean }`. Use `JSON.stringify(result, null, 2)` for structured data.

3. **Validate with Zod at runtime.** Even though the JSON Schema defines the tool's input shape for MCP clients, always validate args with Zod inside the handler. The JSON Schema tells clients what to send; Zod catches malformed input that slips through.

4. **userId comes from the server factory.** `createAscendMcpServer(userId)` in `lib/mcp/server.ts` captures the userId from API key authentication. It is passed to every handler. Never extract userId from args.

5. **Error handling.** Catch `ZodError` separately for validation messages. Catch generic `Error` for service-layer errors. Always set `isError: true` on error responses.

6. **Tool naming convention.** Snake_case: `create_goal`, `list_todos`, `get_dashboard`. Prefix with the action, suffix with the entity.

## Existing Tool Groups

| Set constant | Handler file | Tools |
|-------------|-------------|-------|
| GOAL_TOOL_NAMES | `tools/goal-tools.ts` | create_goal, get_goal, update_goal, delete_goal, list_goals, search_goals |
| PROGRESS_TOOL_NAMES | `tools/progress-tools.ts` | add_progress, get_progress_history |
| BULK_TOOL_NAMES | `tools/bulk-tools.ts` | complete_goals, move_goal |
| DASHBOARD_TOOLS | `tools/dashboard-tools.ts` | get_dashboard, get_current_priorities, get_stats, get_timeline |
| CATEGORY_TOOLS | `tools/category-tools.ts` | create_category, update_category, delete_category, list_categories |
| DATA_TOOLS | `tools/data-tools.ts` | export_data, import_data, get_settings, update_settings |
| CONTEXT_TOOLS | `tools/context-tools.ts` | set_context, get_context, list_context, search_context, delete_context |
| TODO_TOOLS | `tools/todo-tools.ts` | create_todo, get_todo, update_todo, delete_todo, list_todos, complete_todo, search_todos, get_daily_big3, set_daily_big3, get_todos_for_date |
