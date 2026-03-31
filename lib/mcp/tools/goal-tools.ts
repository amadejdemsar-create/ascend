import { goalService } from "@/lib/services/goal-service";
import { prisma } from "@/lib/db";
import {
  createGoalSchema,
  updateGoalSchema,
  goalFiltersSchema,
} from "@/lib/validations";
import { ZodError } from "zod";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Handle all goal-related MCP tool calls.
 * Validates args with Zod v4, delegates to the service layer,
 * and returns MCP-formatted text content.
 */
export async function handleGoalTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "create_goal": {
        const data = createGoalSchema.parse(args);
        const goal = await goalService.create(userId, data);
        return { content: [{ type: "text", text: JSON.stringify(goal, null, 2) }] };
      }

      case "get_goal": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        const goal = await goalService.getById(userId, id);
        if (!goal) {
          return {
            content: [{ type: "text", text: "Goal not found" }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(goal, null, 2) }] };
      }

      case "update_goal": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        const { id: _id, ...rest } = args;
        const data = updateGoalSchema.parse(rest);
        const goal = await goalService.update(userId, id, data);
        return { content: [{ type: "text", text: JSON.stringify(goal, null, 2) }] };
      }

      case "delete_goal": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: id must be a non-empty string" }],
            isError: true,
          };
        }
        const cascade = args.cascade === true;
        if (cascade) {
          await deleteCascade(userId, id);
          return {
            content: [
              {
                type: "text",
                text: "Goal deleted successfully. Children also deleted.",
              },
            ],
          };
        }
        await goalService.delete(userId, id);
        return {
          content: [
            {
              type: "text",
              text: "Goal deleted successfully. Children orphaned (parentId set to null).",
            },
          ],
        };
      }

      case "list_goals": {
        const rawLimit = typeof args.limit === "number" ? args.limit : 50;
        const limit = Math.min(rawLimit, 100);
        const offset = typeof args.offset === "number" ? args.offset : 0;
        const { limit: _l, offset: _o, ...filterArgs } = args;
        const filters = goalFiltersSchema.parse(filterArgs);
        const goals = await goalService.list(userId, filters, {
          skip: offset,
          take: limit,
        });
        const header = `Found ${goals.length} goals (offset: ${offset}, limit: ${limit})`;
        return {
          content: [
            { type: "text", text: `${header}\n\n${JSON.stringify(goals, null, 2)}` },
          ],
        };
      }

      case "search_goals": {
        const query = args.query;
        if (typeof query !== "string" || query.length === 0) {
          return {
            content: [{ type: "text", text: "Validation error: query must be a non-empty string" }],
            isError: true,
          };
        }
        const goals = await goalService.search(userId, query);
        return {
          content: [
            {
              type: "text",
              text: `Found ${goals.length} goals matching '${query}'\n\n${JSON.stringify(goals, null, 2)}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown goal tool: ${name}` }],
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

/**
 * Recursively delete a goal and all its descendants.
 */
async function deleteCascade(userId: string, goalId: string): Promise<void> {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    include: { children: { select: { id: true } } },
  });
  if (!goal) throw new Error("Goal not found");

  // Delete children first (depth-first)
  for (const child of goal.children) {
    await deleteCascade(userId, child.id);
  }
  await prisma.goal.delete({ where: { id: goalId } });
}
