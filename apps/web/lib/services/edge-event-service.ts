/**
 * Edge Event Service — append-only edge audit log.
 *
 * Records every ContextLink creation, removal, and update as an immutable
 * EdgeEvent row. These events are consumed by:
 * - graph-snapshot-service.ts for replaying edge state at a historical date
 * - Phase 5 API routes for edge history timeline
 * - Future retention/compaction (not yet implemented for edge events)
 *
 * All log methods are fire-and-forget from the caller's perspective:
 * they catch their own errors so that a failed audit write never causes
 * the originating link mutation to roll back. This mirrors the
 * "error-tolerant write" pattern from block-document-service.ts.
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import type { ContextLink } from "../../generated/prisma/client";

// ── Service ──────────────────────────────────────────────────────────

export const edgeEventService = {
  /**
   * Log a link creation event. Called by contextLinkService after a
   * successful create/upsert.
   */
  async logCreated(userId: string, workspaceId: string, link: ContextLink): Promise<void> {
    await prisma.edgeEvent
      .create({
        data: {
          userId,
          workspaceId,
          eventType: "CREATED",
          linkSnapshot: link as never,
          fromEntryId: link.fromEntryId,
          toEntryId: link.toEntryId,
        },
      })
      .catch((err) => {
        console.error(
          "[edge-event] logCreated failed; mutation succeeded but audit lost",
          { linkId: link.id, err },
        );
      });
  },

  /**
   * Log a link removal event. Called by contextLinkService after a
   * successful delete.
   */
  async logRemoved(userId: string, workspaceId: string, link: ContextLink): Promise<void> {
    await prisma.edgeEvent
      .create({
        data: {
          userId,
          workspaceId,
          eventType: "REMOVED",
          linkSnapshot: link as never,
          fromEntryId: link.fromEntryId,
          toEntryId: link.toEntryId,
        },
      })
      .catch((err) => {
        console.error("[edge-event] logRemoved failed", {
          linkId: link.id,
          err,
        });
      });
  },

  /**
   * Log a link update event (type change). Stores both before and after
   * states in the linkSnapshot field.
   */
  async logUpdated(
    userId: string,
    workspaceId: string,
    before: ContextLink,
    after: ContextLink,
  ): Promise<void> {
    await prisma.edgeEvent
      .create({
        data: {
          userId,
          workspaceId,
          eventType: "UPDATED",
          linkSnapshot: { before, after } as never,
          fromEntryId: after.fromEntryId,
          toEntryId: after.toEntryId,
        },
      })
      .catch((err) => {
        console.error("[edge-event] logUpdated failed", {
          linkId: after.id,
          err,
        });
      });
  },

  /**
   * List edge events involving a specific entry (as either fromEntry or
   * toEntry). userId-scoped. Ordered by createdAt DESC.
   */
  async listEventsForEntry(
    userId: string,
    workspaceId: string,
    entryId: string,
    opts?: { limit?: number },
  ) {
    const limit = Math.min(opts?.limit ?? 100, 500);
    return prisma.edgeEvent.findMany({
      where: {
        userId,
        workspaceId,
        OR: [{ fromEntryId: entryId }, { toEntryId: entryId }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  /**
   * List all edge events for a user within a time range. Used by
   * graph-snapshot-service for replaying edge state.
   */
  async listEventsBeforeCutoff(
    userId: string,
    workspaceId: string,
    cutoff: Date,
  ) {
    return prisma.edgeEvent.findMany({
      where: { userId, workspaceId, createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
    });
  },
};
