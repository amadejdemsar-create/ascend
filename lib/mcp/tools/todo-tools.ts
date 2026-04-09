import { todoService } from "@/lib/services/todo-service";
import {
  createTodoSchema,
  updateTodoSchema,
  todoFiltersSchema,
} from "@/lib/validations";
import { ZodError } from "zod";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Handle all todo-related MCP tool calls.
 * Validates args with Zod, delegates to the todo service layer,
 * and returns MCP-formatted text content.
 */
export async function handleTodoTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "create_todo": {
        // Extract recurrence fields before Zod parsing (not in createTodoSchema)
        const { isRecurring, recurrenceRule, ...rest } = args;
        const data = createTodoSchema.parse(rest);
        const created = await todoService.create(userId, data);

        // If recurrence fields provided, apply via update
        if (isRecurring || recurrenceRule) {
          await todoService.update(userId, created.id, {
            ...(isRecurring != null && { isRecurring: Boolean(isRecurring) }),
            ...(recurrenceRule != null && { recurrenceRule: String(recurrenceRule) }),
          } as Record<string, unknown>);
          const final = await todoService.getById(userId, created.id);
          return { content: [{ type: "text", text: JSON.stringify(final, null, 2) }] };
        }

        return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
      }

      case "get_todo": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        const todo = await todoService.getById(userId, id);
        if (!todo) {
          return {
            content: [{ type: "text", text: `To-do not found: ${id}` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(todo, null, 2) }] };
      }

      case "update_todo": {
        const { id, ...rest } = args;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        const data = updateTodoSchema.parse(rest);
        const updated = await todoService.update(userId, id, data);
        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
      }

      case "delete_todo": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        await todoService.delete(userId, id);
        return { content: [{ type: "text", text: `Deleted to-do: ${id}` }] };
      }

      case "list_todos": {
        // Convert boolean isBig3 to string for todoFiltersSchema
        const filterArgs: Record<string, unknown> = { ...args };
        delete filterArgs.limit;
        delete filterArgs.offset;
        if (typeof filterArgs.isBig3 === "boolean") {
          filterArgs.isBig3 = filterArgs.isBig3 ? "true" : "false";
        }

        const filters = todoFiltersSchema.parse(filterArgs);
        const limit = typeof args.limit === "number" ? args.limit : 50;
        const offset = typeof args.offset === "number" ? args.offset : 0;

        const todos = await todoService.list(userId, filters, {
          skip: offset,
          take: limit,
        });
        return { content: [{ type: "text", text: JSON.stringify(todos, null, 2) }] };
      }

      case "complete_todo": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        const result = await todoService.complete(userId, id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "search_todos": {
        const query = args.query;
        if (typeof query !== "string" || query.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: query must be a non-empty string" }],
            isError: true,
          };
        }
        const results = await todoService.search(userId, query);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      case "get_daily_big3": {
        const date = typeof args.date === "string" ? new Date(args.date) : undefined;
        const big3 = await todoService.getBig3(userId, date);
        return { content: [{ type: "text", text: JSON.stringify(big3, null, 2) }] };
      }

      case "set_daily_big3": {
        const todoIds = args.todoIds;
        if (!Array.isArray(todoIds) || todoIds.length === 0 || !todoIds.every((id) => typeof id === "string")) {
          return {
            content: [{ type: "text", text: "Validation error: todoIds must be a non-empty array of strings" }],
            isError: true,
          };
        }
        const date = typeof args.date === "string" ? new Date(args.date) : undefined;
        const result = await todoService.setBig3(userId, todoIds as string[], date);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_todos_for_date": {
        const date = args.date;
        if (typeof date !== "string" || date.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: date must be a non-empty string (ISO 8601)" }],
            isError: true,
          };
        }
        const todos = await todoService.getByDate(userId, new Date(date));
        return { content: [{ type: "text", text: JSON.stringify(todos, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown todo tool: ${name}` }],
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
