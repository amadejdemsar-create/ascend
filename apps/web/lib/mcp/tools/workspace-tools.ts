/**
 * Workspace + Activity Feed MCP Tool Handlers (Wave 8 Phase 9).
 *
 * 3 tools exposing workspace and activity feed data to AI agents:
 *   list_workspaces, get_workspace, get_activity_events.
 *
 * Each handler validates args via Zod, calls the service layer, and returns
 * McpContent. userId and workspaceId come from createAscendMcpServer(userId,
 * workspaceId) factory. The user MUST NOT be able to override workspaceId
 * via args; it is always the auth-bound value.
 *
 * Follows the Wave 7 version-tools pattern (ok/fail helpers, ZodError catch).
 */

import { ZodError, z } from "zod";
import { workspaceService } from "@/lib/services/workspace-service";
import { activityEventService } from "@/lib/services/activity-event-service";
import { activityFeedQuerySchema } from "@/lib/validations";

// ── Types ────────────────────────────────────────────────────────────

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────

function ok(result: unknown): McpContent {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function fail(message: string): McpContent {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ── Zod schemas for MCP-specific arg parsing ─────────────────────────

const getWorkspaceArgsSchema = z.object({
  id: z.string().min(1).optional(),
});

// ── Handler ──────────────────────────────────────────────────────────

export async function handleWorkspaceTool(
  userId: string,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "list_workspaces": {
        const result = await workspaceService.listForUser(userId);
        return ok(result);
      }

      case "get_workspace": {
        const data = getWorkspaceArgsSchema.parse(args);

        if (!data.id || data.id === workspaceId) {
          // Return the current (auth-bound) workspace
          const workspace = await workspaceService.getById(
            workspaceId,
            userId,
          );
          if (!workspace) {
            return fail("Current workspace not found");
          }
          return ok(workspace);
        }

        // Wave 8 single-workspace: reject requests for a different workspace.
        // In Wave 8b multi-workspace, this would call workspaceService.getById
        // on the user-provided id and rely on the service's ownership check.
        return fail("Workspace not found or not accessible");
      }

      case "get_activity_events": {
        // Validate args via the shared activityFeedQuerySchema.
        // The schema handles coercion (string to Date for `since`,
        // string to number for `limit`, single value to array for eventType).
        const data = activityFeedQuerySchema.parse(args);

        const result = await activityEventService.list(
          userId,
          workspaceId,
          {
            eventTypes: data.eventType,
            since: data.since,
            cursor: data.cursor,
            limit: data.limit,
          },
        );
        return ok(result);
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        content: [
          { type: "text", text: `Validation error: ${error.message}` },
        ],
        isError: true,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail(message);
  }
}
