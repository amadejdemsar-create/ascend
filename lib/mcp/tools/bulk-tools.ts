import { goalService } from "@/lib/services/goal-service";
import { gamificationService } from "@/lib/services/gamification-service";
import { updateGoalSchema } from "@/lib/validations";
import { ZodError } from "zod";

type McpContent = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

// Subset of updateGoalSchema for the move_goal MCP tool: only horizon
// and parentId are movable. Both must still conform to the underlying
// types so the service layer call is type-safe.
const moveGoalSchema = updateGoalSchema.pick({ horizon: true, parentId: true });

/**
 * Handle bulk operation MCP tool calls: complete_goals, move_goal.
 * Validates args, delegates to the service layer,
 * and returns MCP-formatted text content.
 */
export async function handleBulkTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "complete_goals": {
        const ids = args.ids as string[];
        if (!Array.isArray(ids) || ids.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "ids is required and must be a non-empty array of strings" }) }],
            isError: true,
          };
        }

        const succeeded: string[] = [];
        const skipped: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        let totalXpAwarded = 0;

        for (const id of ids) {
          try {
            const existing = await goalService.getById(userId, id);
            if (!existing) {
              failed.push({ id, error: "Goal not found" });
              continue;
            }
            if (existing.status === "COMPLETED") {
              skipped.push(id);
              continue;
            }
            await goalService.update(userId, id, { status: "COMPLETED" });
            const xpResult = await gamificationService.awardXp(
              userId,
              id,
              existing.horizon,
              existing.priority,
            );
            totalXpAwarded += xpResult.amount;
            succeeded.push(id);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failed.push({ id, error: message });
          }
        }

        let text = `Completed ${succeeded.length}/${ids.length} goals. +${totalXpAwarded} XP earned.`;
        if (skipped.length > 0) text += `\nSkipped ${skipped.length} already completed.`;
        if (failed.length > 0) text += `\nFailed: ${JSON.stringify(failed)}`;
        return { content: [{ type: "text", text }] };
      }

      case "move_goal": {
        const id = args.id;
        if (typeof id !== "string" || id.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "id is required and must be a non-empty string" }) }],
            isError: true,
          };
        }

        // Extract only horizon and parentId from args so extra keys
        // (e.g., ids from complete_goals) cannot slip through.
        const rawPayload: Record<string, unknown> = {};
        if ("horizon" in args && args.horizon !== undefined) {
          rawPayload.horizon = args.horizon;
        }
        if ("parentId" in args) {
          rawPayload.parentId = args.parentId ?? null;
        }

        const payload = moveGoalSchema.parse(rawPayload);
        const result = await goalService.update(userId, id, payload);
        const text = `Goal moved successfully.\n\n${JSON.stringify(result, null, 2)}`;
        return { content: [{ type: "text", text }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown bulk tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Validation error", details: error.issues }),
          },
        ],
        isError: true,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
}
