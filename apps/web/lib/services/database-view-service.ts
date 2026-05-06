/**
 * Database View Service.
 *
 * CRUD for DatabaseView entities. Each database can have multiple views
 * (Table, Board, Calendar, Gallery, Timeline). Views store their config
 * (column widths, filters, sorts, group-by, etc.) as validated JSON.
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import type {
  CreateDatabaseViewInput,
  UpdateDatabaseViewInput,
} from "@/lib/validations";
import { databaseViewConfigSchema } from "@/lib/validations";
import { permissionService } from "@/lib/services/permission-service";

export const databaseViewService = {
  /**
   * Create a new view for a database. Validates config against the
   * view-type-specific Zod schema. Auto-positions to the end.
   */
  async create(
    userId: string,
    workspaceId: string,
    databaseId: string,
    input: CreateDatabaseViewInput,
  ) {
    // Permission check (mutating operation: creates a view)
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    // Verify database ownership
    const database = await prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
    });
    if (!database) throw new Error("Database not found");

    // Build and validate config (use defaults if not provided)
    const rawConfig = input.config ?? { type: input.type };
    const config = databaseViewConfigSchema.parse(rawConfig);

    // Determine position (max + 1)
    const maxView = await prisma.databaseView.findFirst({
      where: { databaseId, userId, workspaceId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (maxView?.position ?? -1) + 1;

    return prisma.databaseView.create({
      data: {
        userId,
        workspaceId,
        databaseId,
        name: input.name,
        type: input.type,
        config: config as unknown as Prisma.InputJsonValue,
        position,
      },
    });
  },

  /**
   * Update a view's name, config, or position. Validates config if provided.
   */
  async update(
    userId: string,
    workspaceId: string,
    viewId: string,
    input: UpdateDatabaseViewInput,
  ) {
    // Permission check (mutating operation)
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    const existing = await prisma.databaseView.findFirst({
      where: { id: viewId, userId, workspaceId },
    });
    if (!existing) throw new Error("View not found");

    const updateData: Prisma.DatabaseViewUpdateInput = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.config !== undefined) {
      // Validate config against the discriminated union
      const config = databaseViewConfigSchema.parse(input.config);
      updateData.config = config as unknown as Prisma.InputJsonValue;
    }

    if (input.position !== undefined) {
      updateData.position = input.position;
    }

    return prisma.databaseView.update({
      where: { id: viewId },
      data: updateData,
    });
  },

  /**
   * Delete a view. Refuses if it's the database's defaultViewId and no
   * other view exists to fall back to.
   */
  async delete(userId: string, workspaceId: string, viewId: string): Promise<{ id: string }> {
    // Permission check (mutating operation: deletes a view)
    await permissionService.assertCanPerform(userId, workspaceId, "DELETE_NODE");

    const existing = await prisma.databaseView.findFirst({
      where: { id: viewId, userId, workspaceId },
      include: { database: { select: { id: true, defaultViewId: true } } },
    });
    if (!existing) throw new Error("View not found");

    // Check if this is the default view
    if (existing.database.defaultViewId === viewId) {
      // Find another view to promote
      const otherView = await prisma.databaseView.findFirst({
        where: {
          databaseId: existing.databaseId,
          userId,
          workspaceId,
          id: { not: viewId },
        },
        orderBy: { position: "asc" },
      });

      if (!otherView) {
        throw new Error(
          "Cannot delete the only view. Create another view first, then delete this one.",
        );
      }

      // Refuse deletion of the default if it's the only one left
      // (even if other views exist, we refuse and ask the user to set a new default first)
      throw new Error(
        "Cannot delete the default view. Set a different view as default first via setDefault.",
      );
    }

    await prisma.databaseView.delete({ where: { id: viewId } });
    return { id: viewId };
  },

  /**
   * Set a view as the database's default. Verifies ownership.
   */
  async setDefault(userId: string, workspaceId: string, viewId: string) {
    // Permission check (mutating operation)
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    const existing = await prisma.databaseView.findFirst({
      where: { id: viewId, userId, workspaceId },
      include: { database: { select: { id: true, userId: true } } },
    });
    if (!existing) throw new Error("View not found");
    if (existing.database.userId !== userId) throw new Error("View not found");

    await prisma.database.update({
      where: { id: existing.databaseId },
      data: { defaultViewId: viewId },
    });

    return prisma.databaseView.findFirst({
      where: { id: viewId, userId, workspaceId },
    });
  },

  /**
   * List all views for a database, ordered by position.
   */
  async list(userId: string, workspaceId: string, databaseId: string) {
    // Verify database ownership
    const database = await prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
    });
    if (!database) throw new Error("Database not found");

    return prisma.databaseView.findMany({
      where: { databaseId, userId, workspaceId },
      orderBy: { position: "asc" },
    });
  },
};
