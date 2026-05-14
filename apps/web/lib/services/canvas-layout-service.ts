import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/db";
import type {
  CreateCanvasLayoutInput,
  UpdateCanvasLayoutInput,
} from "@/lib/validations";
import { permissionService } from "@/lib/services/permission-service";
import { activityEventService } from "@/lib/services/activity-event-service";

// ---------------------------------------------------------------------------
// Canvas layout service (Wave 9)
//
// Manages CanvasLayout CRUD. Every method is userId+workspaceId scoped
// (safety rule 1, DZ-22). Writes pass through permissionService.
//
// The `canvas` field stores the full Excalidraw scene as JSONB. The DB
// has CHECK constraints at 2 MiB (canvas) and 8 KiB (viewport). The
// service layer adds a defensive pre-flight check so we return a clean
// 4xx instead of a 500 / CHECK violation on oversize payloads (DZ-25).
//
// Activity events fire fire-and-forget AFTER the transaction commits:
//   CANVAS_LAYOUT_CREATED on create + getDefault (when lazily created)
//   CANVAS_LAYOUT_DELETED on delete
// ---------------------------------------------------------------------------

const CANVAS_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB (matches DB CHECK)
const VIEWPORT_MAX_BYTES = 8 * 1024; // 8 KiB (matches DB CHECK)

const DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1,
  showEdges: true,
  cardSize: "default" as const,
};
const DEFAULT_CANVAS = { elements: [], appState: {} };

/**
 * Slugify a layout name. lowercase + hyphens + alphanumeric only.
 * Falls back to "layout" if the result would be empty.
 */
function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "layout";
}

/**
 * Compute a unique slug for this user by appending -2, -3, ... if the
 * base slug is taken. Called inside transactions so we can hold the
 * uniqueness check + insert atomically.
 */
async function findUniqueSlug(
  tx: Prisma.TransactionClient,
  userId: string,
  baseSlug: string,
): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
    const existing = await tx.canvasLayout.findFirst({
      where: { userId, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  // Pathological: 100 collisions in a row. Append a random suffix.
  return `${baseSlug}-${Date.now().toString(36)}`;
}

function preflightCanvasSize(canvas: unknown): void {
  const serialized = JSON.stringify(canvas);
  if (serialized.length > CANVAS_MAX_BYTES) {
    throw new Error(
      `Canvas scene exceeds 2 MiB cap (${serialized.length} bytes). Reduce element count or remove embedded base64 images.`,
    );
  }
}

function preflightViewportSize(viewport: unknown): void {
  const serialized = JSON.stringify(viewport);
  if (serialized.length > VIEWPORT_MAX_BYTES) {
    throw new Error(
      `Canvas viewport exceeds 8 KiB cap (${serialized.length} bytes).`,
    );
  }
}

export const canvasLayoutService = {
  /**
   * List the user's layouts in this workspace, newest-updated first.
   * Excludes the `canvas` blob to keep the response small (clients use
   * getById for the full scene).
   */
  async list(userId: string, workspaceId: string) {
    return prisma.canvasLayout.findMany({
      where: { userId, workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        isDefault: true,
        viewport: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { nodes: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  /**
   * Get one layout including the full canvas scene and node list.
   * Returns null if not found or not owned by the user in this workspace.
   */
  async getById(userId: string, workspaceId: string, id: string) {
    const layout = await prisma.canvasLayout.findFirst({
      where: { id, userId, workspaceId },
      include: {
        nodes: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return layout;
  },

  /**
   * Get a layout by slug (per-user unique). Useful for deep links.
   */
  async getBySlug(userId: string, workspaceId: string, slug: string) {
    const layout = await prisma.canvasLayout.findFirst({
      where: { userId, workspaceId, slug },
      include: { nodes: { orderBy: { createdAt: "asc" } } },
    });
    return layout;
  },

  /**
   * Get the user's default layout, creating "Personal" lazily on first
   * visit. Idempotent under concurrent first-visits (the @@unique on
   * userId+slug prevents duplicate creates; the catch block on P2002
   * re-fetches).
   */
  async getDefault(userId: string, workspaceId: string) {
    // Permission gate even on read: ensures the user is a member of the
    // workspace before any auto-create can happen.
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );

    const existing = await prisma.canvasLayout.findFirst({
      where: { userId, workspaceId, isDefault: true },
      include: { nodes: { orderBy: { createdAt: "asc" } } },
    });
    if (existing) return existing;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Double-check inside the transaction in case another request
        // raced us (highly unlikely in single-user prod but cheap).
        const racedExisting = await tx.canvasLayout.findFirst({
          where: { userId, workspaceId, isDefault: true },
        });
        if (racedExisting) return { row: racedExisting, didCreate: false };

        const row = await tx.canvasLayout.create({
          data: {
            userId,
            workspaceId,
            name: "Personal",
            slug: "personal",
            isDefault: true,
            viewport: DEFAULT_VIEWPORT as Prisma.InputJsonValue,
            canvas: DEFAULT_CANVAS as Prisma.InputJsonValue,
          },
        });
        return { row, didCreate: true };
      });

      // Only fire the activity event when WE actually created the layout
      // (not when we lost the race to a concurrent first-visit request).
      if (result.didCreate) {
        void activityEventService.log(
          workspaceId,
          userId,
          "CANVAS_LAYOUT_CREATED",
          {
            eventType: "CANVAS_LAYOUT_CREATED",
            layoutId: result.row.id,
            layoutName: result.row.name,
          },
        );
      }

      // Re-fetch with nodes to match getById's shape.
      const full = await prisma.canvasLayout.findUnique({
        where: { id: result.row.id },
        include: { nodes: { orderBy: { createdAt: "asc" } } },
      });
      // Cannot be null: we just created or raced-into it.
      if (!full)
        throw new Error("Failed to load just-created default layout");
      return full;
    } catch (err) {
      // P2002 = unique constraint violation. Another request already
      // created the default while we were checking; re-fetch.
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        const winner = await prisma.canvasLayout.findFirst({
          where: { userId, workspaceId, isDefault: true },
          include: { nodes: { orderBy: { createdAt: "asc" } } },
        });
        if (winner) return winner;
      }
      throw err;
    }
  },

  /**
   * Create a new layout. Auto-derives slug from name if missing,
   * appending a numeric suffix on collision.
   */
  async create(
    userId: string,
    workspaceId: string,
    input: CreateCanvasLayoutInput,
  ) {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );

    const baseSlug = input.slug ?? slugifyName(input.name);

    const created = await prisma.$transaction(async (tx) => {
      const slug = await findUniqueSlug(tx, userId, baseSlug);
      return tx.canvasLayout.create({
        data: {
          userId,
          workspaceId,
          name: input.name,
          slug,
          isDefault: false,
          viewport: DEFAULT_VIEWPORT as Prisma.InputJsonValue,
          canvas: DEFAULT_CANVAS as Prisma.InputJsonValue,
        },
      });
    });

    void activityEventService.log(workspaceId, userId, "CANVAS_LAYOUT_CREATED", {
      eventType: "CANVAS_LAYOUT_CREATED",
      layoutId: created.id,
      layoutName: created.name,
    });

    return created;
  },

  /**
   * Update a layout. Partial; only the fields present in input are
   * touched. The 2 MiB / 8 KiB caps are pre-flighted before the
   * write so we return a clean error rather than a CHECK violation.
   */
  async update(
    userId: string,
    workspaceId: string,
    id: string,
    input: UpdateCanvasLayoutInput,
  ) {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "WRITE_NODE",
    );

    if (input.canvas !== undefined) preflightCanvasSize(input.canvas);
    if (input.viewport !== undefined) preflightViewportSize(input.viewport);

    // Ownership check first; throws if not the user's own layout in this workspace.
    const existing = await prisma.canvasLayout.findFirst({
      where: { id, userId, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new Error("Canvas layout not found");

    // Slug uniqueness check (only if slug is changing).
    if (input.slug !== undefined) {
      const conflict = await prisma.canvasLayout.findFirst({
        where: { userId, slug: input.slug, NOT: { id } },
        select: { id: true },
      });
      if (conflict)
        throw new Error(`Slug "${input.slug}" is already in use.`);
    }

    return prisma.canvasLayout.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        ...(input.viewport !== undefined && {
          viewport: input.viewport as Prisma.InputJsonValue,
        }),
        ...(input.canvas !== undefined && {
          canvas: input.canvas as Prisma.InputJsonValue,
        }),
      },
    });
  },

  /**
   * Delete a layout. Refuses if it is the user's only layout in this
   * workspace (we always keep at least one). CASCADE on FK removes
   * all CanvasNode rows for the layout.
   */
  async delete(userId: string, workspaceId: string, id: string) {
    await permissionService.assertCanPerform(
      userId,
      workspaceId,
      "DELETE_NODE",
    );

    const layout = await prisma.canvasLayout.findFirst({
      where: { id, userId, workspaceId },
      select: { id: true, name: true },
    });
    if (!layout) throw new Error("Canvas layout not found");

    const count = await prisma.canvasLayout.count({
      where: { userId, workspaceId },
    });
    if (count <= 1) {
      throw new Error(
        "Cannot delete the only canvas layout. Create another layout first.",
      );
    }

    await prisma.canvasLayout.delete({ where: { id } });

    void activityEventService.log(workspaceId, userId, "CANVAS_LAYOUT_DELETED", {
      eventType: "CANVAS_LAYOUT_DELETED",
      layoutId: layout.id,
      layoutName: layout.name,
    });
  },
};
