/**
 * Diff Service — wraps @ascend/diff for version comparison.
 *
 * Provides a userId-scoped API for diffing two NodeVersion payloads or
 * diffing a version against the current live state. Validates that both
 * versions belong to the same user and the same node before diffing.
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { diffNodeVersions, type DiffResult } from "@ascend/diff";
import { versioningService } from "./versioning-service";
import type { NodeType } from "@/lib/validations";

// ── Service ──────────────────────────────────────────────────────────

export const diffService = {
  /**
   * Diff two versions of the same node.
   *
   * @param fromVersionId - The "before" version ID. Pass null to diff
   *   against the current live state (fetches the live entity payload).
   * @param toVersionId - The "after" version ID (required).
   *
   * Both versions must belong to the same user and the same (nodeType, nodeId).
   * Throws on mismatch.
   */
  async diffVersions(
    userId: string,
    fromVersionId: string | null,
    toVersionId: string,
  ): Promise<DiffResult> {
    const to = await versioningService.getVersion(userId, toVersionId);
    if (!to) throw new Error("Version not found");

    const nodeType = to.nodeType as NodeType;
    let fromPayload: Record<string, unknown>;

    if (fromVersionId === null) {
      // Diff against current live state
      const live = await versioningService._fetchEntityPayload(
        userId,
        nodeType,
        to.nodeId,
      );
      if (!live) throw new Error("Live entity not found for diff vs current");
      fromPayload = live;
    } else {
      const from = await versioningService.getVersion(userId, fromVersionId);
      if (!from) throw new Error("Version not found");
      if (from.nodeType !== to.nodeType || from.nodeId !== to.nodeId) {
        throw new Error("Cannot diff versions of different nodes");
      }
      fromPayload = from.payload as Record<string, unknown>;
    }

    return diffNodeVersions({
      fromPayload,
      toPayload: to.payload as Record<string, unknown>,
      nodeType,
    });
  },
};
