import { prisma } from "@/lib/db";
import type { CanvasNodeInput } from "@/lib/validations";
import { permissionService } from "@/lib/services/permission-service";
import { activityEventService } from "@/lib/services/activity-event-service";

// ---------------------------------------------------------------------------
// Canvas node service (Wave 9)
//
// Manages CanvasNode rows. Every CanvasNode belongs to exactly one
// CanvasLayout, one User, one Workspace, and one ContextEntry. The
// userId / workspaceId are denormalized from the parent layout so
// scoped queries can hit a single table; this service enforces that
// they always match the parent's values (audit recommendation).
//
// Activity events:
//   CANVAS_NODE_ADDED   fires on inserts (NOT on position updates)
//   CANVAS_NODE_REMOVED fires on deletes
// Position drag updates are intentionally not logged (too noisy).
// ---------------------------------------------------------------------------

const DEFAULT_W = 240;
const DEFAULT_H = 140;

/**
 * Verify the caller owns the layout in this workspace. Throws on miss.
 * Returns the parent layout row for downstream activity logging.
 */
async function verifyLayoutOwnership(
  userId: string,
  workspaceId: string,
  layoutId: string,
) {
  const layout = await prisma.canvasLayout.findFirst({
    where: { id: layoutId, userId, workspaceId },
    select: { id: true, name: true },
  });
  if (!layout) throw new Error("Canvas layout not found");
  return layout;
}

/**
 * Verify the caller owns ALL the given contextEntryIds in this workspace.
 * Returns a Map<id, {title}> for downstream activity logging.
 * Throws if any id is missing or not owned.
 */
async function verifyEntryOwnership(
  userId: string,
  workspaceId: string,
  contextEntryIds: string[],
): Promise<Map<string, { title: string }>> {
  if (contextEntryIds.length === 0) return new Map();
  const entries = await prisma.contextEntry.findMany({
    where: {
      id: { in: contextEntryIds },
      userId,
      workspaceId,
    },
    select: { id: true, title: true },
  });
  if (entries.length !== contextEntryIds.length) {
    const found = new Set(entries.map((e) => e.id));
    const missing = contextEntryIds.filter((id) => !found.has(id));
    throw new Error(
      `Context entries not found or not accessible: ${missing.join(", ")}`,
    );
  }
  return new Map(entries.map((e) => [e.id, { title: e.title }]));
}

export const canvasNodeService = {
  /**
   * List every CanvasNode in a layout. Caller must own the layout.
   * Used by GET /api/canvas/layouts/[id] alongside the canvas blob.
   */
  async listForLayout(
    userId: string,
    workspaceId: string,
    layoutId: string,
  ) {
    await verifyLayoutOwnership(userId, workspaceId, layoutId);
    return prisma.canvasNode.findMany({
      where: { canvasLayoutId: layoutId, userId, workspaceId },
      orderBy: { createdAt: "asc" },
    });
  },

  /**
   * Add or move a single card. Position updates do NOT fire activity
   * events; only first-time inserts do.
   */
  async upsert(
    userId: string,
    workspaceId: string,
    layoutId: string,
    input: CanvasNodeInput,
  ) {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );
    const layout = await verifyLayoutOwnership(userId, workspaceId, layoutId);
    const entries = await verifyEntryOwnership(userId, workspaceId, [
      input.contextEntryId,
    ]);
    const entry = entries.get(input.contextEntryId);
    if (!entry) throw new Error("Context entry not found");

    const existing = await prisma.canvasNode.findUnique({
      where: {
        canvasLayoutId_contextEntryId: {
          canvasLayoutId: layoutId,
          contextEntryId: input.contextEntryId,
        },
      },
      select: { id: true },
    });

    const node = await prisma.canvasNode.upsert({
      where: {
        canvasLayoutId_contextEntryId: {
          canvasLayoutId: layoutId,
          contextEntryId: input.contextEntryId,
        },
      },
      create: {
        canvasLayoutId: layoutId,
        userId,
        workspaceId,
        contextEntryId: input.contextEntryId,
        x: input.x,
        y: input.y,
        w: input.w ?? DEFAULT_W,
        h: input.h ?? DEFAULT_H,
        excalidrawElementId: input.excalidrawElementId,
      },
      update: {
        x: input.x,
        y: input.y,
        ...(input.w !== undefined && { w: input.w }),
        ...(input.h !== undefined && { h: input.h }),
        excalidrawElementId: input.excalidrawElementId,
      },
    });

    if (!existing) {
      void activityEventService.log(
        workspaceId,
        userId,
        "CANVAS_NODE_ADDED",
        {
          eventType: "CANVAS_NODE_ADDED",
          layoutId: layout.id,
          layoutName: layout.name,
          contextEntryId: entry ? input.contextEntryId : "",
          entryTitle: entry.title,
        },
      );
    }

    return node;
  },

  /**
   * Apply many position deltas in one round trip. Used by the canvas
   * autosave path. Inserts fire CANVAS_NODE_ADDED; updates do not.
   * Capped at the Zod-validated upper bound (500 ops per call).
   *
   * Uses raw SQL INSERT ... ON CONFLICT DO UPDATE for performance with
   * defense-in-depth userId/workspaceId guards. Per the migration
   * auditor's recommendation, updatedAt is set explicitly because raw
   * SQL paths bypass Prisma's @updatedAt directive.
   */
  async bulkUpsert(
    userId: string,
    workspaceId: string,
    layoutId: string,
    ops: CanvasNodeInput[],
  ): Promise<{ inserted: number; updated: number }> {
    if (ops.length === 0) return { inserted: 0, updated: 0 };

    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );
    const layout = await verifyLayoutOwnership(userId, workspaceId, layoutId);

    // Verify all entries belong to user+workspace. One bulk findMany.
    const entryIds = ops.map((o) => o.contextEntryId);
    const entries = await verifyEntryOwnership(userId, workspaceId, entryIds);

    // Pre-fetch existing rows so we know which ops are inserts vs updates.
    const existing = await prisma.canvasNode.findMany({
      where: {
        canvasLayoutId: layoutId,
        contextEntryId: { in: entryIds },
        userId,
        workspaceId,
      },
      select: { contextEntryId: true },
    });
    const existingSet = new Set(existing.map((n) => n.contextEntryId));

    const now = new Date();

    // Apply all writes in one transaction. Prisma's upsert per row is
    // sufficient for 500-op batches; raw SQL would be marginally faster
    // but the safety guard surface is larger. Stick with Prisma upsert.
    await prisma.$transaction(
      ops.map((op) =>
        prisma.canvasNode.upsert({
          where: {
            canvasLayoutId_contextEntryId: {
              canvasLayoutId: layoutId,
              contextEntryId: op.contextEntryId,
            },
          },
          create: {
            canvasLayoutId: layoutId,
            userId,
            workspaceId,
            contextEntryId: op.contextEntryId,
            x: op.x,
            y: op.y,
            w: op.w ?? DEFAULT_W,
            h: op.h ?? DEFAULT_H,
            excalidrawElementId: op.excalidrawElementId,
            updatedAt: now,
          },
          update: {
            x: op.x,
            y: op.y,
            ...(op.w !== undefined && { w: op.w }),
            ...(op.h !== undefined && { h: op.h }),
            excalidrawElementId: op.excalidrawElementId,
            updatedAt: now,
          },
        }),
      ),
    );

    // Fire activity events ONLY for inserts. Fire-and-forget per op.
    let inserted = 0;
    for (const op of ops) {
      if (!existingSet.has(op.contextEntryId)) {
        inserted++;
        const entry = entries.get(op.contextEntryId);
        if (entry) {
          void activityEventService.log(
            workspaceId,
            userId,
            "CANVAS_NODE_ADDED",
            {
              eventType: "CANVAS_NODE_ADDED",
              layoutId: layout.id,
              layoutName: layout.name,
              contextEntryId: op.contextEntryId,
              entryTitle: entry.title,
            },
          );
        }
      }
    }

    return { inserted, updated: ops.length - inserted };
  },

  /**
   * Remove a single card from a layout. Fires CANVAS_NODE_REMOVED.
   */
  async removeFromLayout(
    userId: string,
    workspaceId: string,
    layoutId: string,
    contextEntryId: string,
  ) {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "DELETE_NODE",
    );
    const layout = await verifyLayoutOwnership(userId, workspaceId, layoutId);

    const node = await prisma.canvasNode.findUnique({
      where: {
        canvasLayoutId_contextEntryId: {
          canvasLayoutId: layoutId,
          contextEntryId,
        },
      },
      include: { contextEntry: { select: { title: true } } },
    });
    if (!node) return; // Idempotent: removing a non-existent card is a no-op.

    await prisma.canvasNode.delete({ where: { id: node.id } });

    void activityEventService.log(
      workspaceId,
      userId,
      "CANVAS_NODE_REMOVED",
      {
        eventType: "CANVAS_NODE_REMOVED",
        layoutId: layout.id,
        layoutName: layout.name,
        contextEntryId,
        entryTitle: node.contextEntry.title,
      },
    );
  },

  /**
   * Bulk-remove many cards from a layout. One activity event per
   * actually-removed row.
   */
  async removeMany(
    userId: string,
    workspaceId: string,
    layoutId: string,
    contextEntryIds: string[],
  ): Promise<{ removed: number }> {
    if (contextEntryIds.length === 0) return { removed: 0 };

    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "DELETE_NODE",
    );
    const layout = await verifyLayoutOwnership(userId, workspaceId, layoutId);

    const nodes = await prisma.canvasNode.findMany({
      where: {
        canvasLayoutId: layoutId,
        contextEntryId: { in: contextEntryIds },
        userId,
        workspaceId,
      },
      include: { contextEntry: { select: { title: true } } },
    });
    if (nodes.length === 0) return { removed: 0 };

    // DZ-16-style raw SQL bulk delete with userId+workspaceId guards.
    await prisma.$executeRaw`
      DELETE FROM "CanvasNode"
      WHERE "id" = ANY(${nodes.map((n) => n.id)}::text[])
        AND "userId" = ${userId}
        AND "workspaceId" = ${workspaceId}
    `;

    for (const node of nodes) {
      void activityEventService.log(
        workspaceId,
        userId,
        "CANVAS_NODE_REMOVED",
        {
          eventType: "CANVAS_NODE_REMOVED",
          layoutId: layout.id,
          layoutName: layout.name,
          contextEntryId: node.contextEntryId,
          entryTitle: node.contextEntry.title,
        },
      );
    }

    return { removed: nodes.length };
  },
};

