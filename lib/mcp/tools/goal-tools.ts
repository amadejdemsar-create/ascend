import { goalService } from "@/lib/services/goal-service";
import { prisma } from "@/lib/db";
import {
  createGoalSchema,
  updateGoalSchema,
  goalFiltersSchema,
} from "@/lib/validations";

type McpContent = { content: Array<{ type: "text"; text: string }> };

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
  switch (name) {
    case "create_goal": {
      const data = createGoalSchema.parse(args);
      const goal = await goalService.create(userId, data);
      return { content: [{ type: "text", text: JSON.stringify(goal, null, 2) }] };
    }

    case "get_goal": {
      const { id } = args as { id: string };
      const goal = await goalService.getById(userId, id);
      if (!goal) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Goal not found" }) }],
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(goal, null, 2) }] };
    }

    case "update_goal": {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      const data = updateGoalSchema.parse(rest);
      const goal = await goalService.update(userId, id, data);
      return { content: [{ type: "text", text: JSON.stringify(goal, null, 2) }] };
    }

    case "delete_goal": {
      const { id, cascade } = args as { id: string; cascade?: boolean };
      if (cascade) {
        await deleteCascade(userId, id);
        return {
          content: [{ type: "text", text: JSON.stringify({ deleted: true, cascade: true }) }],
        };
      }
      const goal = await goalService.delete(userId, id);
      return { content: [{ type: "text", text: JSON.stringify(goal, null, 2) }] };
    }

    case "list_goals": {
      const { limit = 50, offset = 0, ...filterArgs } = args as {
        limit?: number;
        offset?: number;
      } & Record<string, unknown>;
      const filters = goalFiltersSchema.parse(filterArgs);
      const goals = await goalService.list(userId, filters, {
        skip: offset,
        take: limit,
      });
      return { content: [{ type: "text", text: JSON.stringify(goals, null, 2) }] };
    }

    case "search_goals": {
      const { query } = args as { query: string };
      const goals = await goalService.search(userId, query);
      return { content: [{ type: "text", text: JSON.stringify(goals, null, 2) }] };
    }

    default:
      throw new Error(`Unknown goal tool: ${name}`);
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
