/**
 * Activity Event Service — workspace-level activity feed.
 *
 * Two methods:
 *   log()  — fire-and-forget event logging. Never throws to the caller;
 *            failures are caught and logged to stderr. This is critical:
 *            a logging failure must never break a goal create, todo
 *            delete, or any other originating mutation.
 *
 *   list() — cursor-paginated feed for a workspace. Ownership is verified
 *            via WorkspaceMembership before querying.
 *
 * Follows the const-object service pattern.
 * The table schema (ActivityEvent) stores payload as JSONB; Prisma
 * returns it as `unknown`. We cast to `ActivityEventPayload` in the
 * response without re-parsing every row (perf: the hot read path
 * should not pay Zod validation cost on already-validated data).
 */

import { prisma } from "@/lib/db";
import type {
  ActivityEventType,
  ActivityEventPayload,
} from "@/lib/validations";
import type { Prisma } from "../../generated/prisma/client";

// ── Response types ───────────────────────────────────────────────────

export type ActivityEventWithActor = {
  id: string;
  workspaceId: string;
  userId: string | null;
  eventType: ActivityEventType;
  payload: ActivityEventPayload;
  createdAt: Date;
  actorDisplayName: string | null;
};

export type ActivityFeedResult = {
  events: ActivityEventWithActor[];
  nextCursor: string | null;
};

// ── Service ──────────────────────────────────────────────────────────

export const activityEventService = {
  /**
   * Log an activity event. Fire-and-forget: never throws to the caller.
   *
   * Call this AFTER the successful write (after the transaction commits,
   * before returning to the caller). Wrap the call site with `void` to
   * make the fire-and-forget intent explicit.
   */
  async log(
    workspaceId: string,
    userId: string,
    eventType: ActivityEventType,
    payload: ActivityEventPayload,
  ): Promise<void> {
    try {
      await prisma.activityEvent.create({
        data: {
          workspaceId,
          userId,
          eventType,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // Fire-and-forget: log but never propagate.
      console.error(
        `[activityEventService.log] Failed to log ${eventType}:`,
        err instanceof Error ? err.message : err,
      );
    }
  },

  /**
   * List activity events for a workspace with cursor pagination.
   *
   * Ownership check: the caller must have an ACTIVE membership in the
   * workspace. Throws "Forbidden" if not.
   *
   * Returns events in reverse chronological order (newest first),
   * with `actorDisplayName` resolved from the user relation.
   */
  async list(
    userId: string,
    workspaceId: string,
    opts?: {
      eventTypes?: ActivityEventType[];
      since?: Date;
      cursor?: string;
      limit?: number;
    },
  ): Promise<ActivityFeedResult> {
    // Ownership check: user must be an active member of the workspace
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!membership) throw new Error("Forbidden");

    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);

    // Build where clause
    const where: Prisma.ActivityEventWhereInput = { workspaceId };
    if (opts?.eventTypes && opts.eventTypes.length > 0) {
      where.eventType = { in: opts.eventTypes };
    }
    if (opts?.since) {
      where.createdAt = { gte: opts.since };
    }

    const rows = await prisma.activityEvent.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opts?.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const events: ActivityEventWithActor[] = slice.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      eventType: row.eventType as ActivityEventType,
      payload: row.payload as unknown as ActivityEventPayload,
      createdAt: row.createdAt,
      actorDisplayName: row.user?.name ?? row.user?.email ?? null,
    }));

    return {
      events,
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  },
};
