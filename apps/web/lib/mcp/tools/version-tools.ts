/**
 * Version / Time-Travel MCP Tool Handlers (Wave 7 Phase 10).
 *
 * 5 tools exposing the versioning system to AI agents:
 *   list_versions, get_version, diff_versions, restore_version, branch_node.
 *
 * Each handler validates args via Zod, calls the service layer, and returns
 * McpContent. userId comes from createAscendMcpServer(userId) factory.
 *
 * Follows the Wave 5 database-tools pattern (ok/fail helpers, ZodError catch).
 */

import { ZodError, z } from "zod";
import { versioningService } from "@/lib/services/versioning-service";
import { diffService } from "@/lib/services/diff-service";
import { restoreService } from "@/lib/services/restore-service";
import { branchService } from "@/lib/services/branch-service";
import {
  nodeTypeEnum,
  diffVersionsBodySchema,
  restoreVersionBodySchema,
  branchNodeBodySchema,
} from "@/lib/validations";

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

const listVersionsArgsSchema = z.object({
  nodeType: nodeTypeEnum,
  nodeId: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

const getVersionArgsSchema = z.object({
  versionId: z.string().min(1),
});

// ── Handler ──────────────────────────────────────────────────────────

export async function handleVersionTool(
  userId: string,
  workspaceId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "list_versions": {
        const data = listVersionsArgsSchema.parse(args);
        const result = await versioningService.listVersions(
          userId,
          workspaceId,
          data.nodeType,
          data.nodeId,
          { limit: data.limit, cursor: data.cursor },
        );
        return ok(result);
      }

      case "get_version": {
        const data = getVersionArgsSchema.parse(args);
        const result = await versioningService.getVersion(userId, workspaceId, data.versionId);
        if (!result) {
          return fail("Version not found");
        }
        return ok(result);
      }

      case "diff_versions": {
        const data = diffVersionsBodySchema.parse(args);
        const result = await diffService.diffVersions(
          userId,
          workspaceId,
          data.fromVersionId,
          data.toVersionId,
        );
        return ok(result);
      }

      case "restore_version": {
        const data = restoreVersionBodySchema.parse(args);
        const result = await restoreService.restore(
          userId,
          workspaceId,
          data.versionId,
          data.dryRun ?? false,
        );
        return ok(result);
      }

      case "branch_node": {
        const data = branchNodeBodySchema.parse(args);
        const result = await branchService.branch(
          userId,
          workspaceId,
          data.versionId,
          data.title,
        );
        return ok(result);
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        content: [{ type: "text", text: `Validation error: ${error.message}` }],
        isError: true,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail(message);
  }
}
