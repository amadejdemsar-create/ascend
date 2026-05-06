/**
 * Database Service.
 *
 * CRUD for the Database entity. Each database is backed by a ContextEntry
 * of type DATABASE, participates in the full context graph, and cascades
 * through field/row/view on deletion.
 *
 * Follows the const-object service pattern (see file-service.ts).
 * userId is always the first parameter.
 *
 * Transactional creates: database creation is a 4-step transaction:
 *   ContextEntry → Database → default "Name" TEXT field → default Table view.
 *
 * DZ-16: Database deletion uses raw SQL to bulk-delete ContextLink rows
 * referencing the database's RELATION fields before cascading.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "../../generated/prisma/client";
import type {
  CreateDatabaseInput,
  UpdateDatabaseInput,
} from "@/lib/validations";
import { permissionService } from "@/lib/services/permission-service";

export const databaseService = {
  /**
   * Create a new database in a single transaction:
   * 1. ContextEntry (type DATABASE)
   * 2. Database row
   * 3. Default "Name" TEXT field (isPrimary: true)
   * 4. Default "Table" view
   * Then update Database.defaultViewId.
   *
   * If parentEntryId is provided, verifies ownership first.
   */
  async create(
    userId: string,
    workspaceId: string,
    input: CreateDatabaseInput,
  ): Promise<{
    database: Awaited<ReturnType<typeof prisma.database.findFirst>>;
    fields: Awaited<ReturnType<typeof prisma.databaseField.findMany>>;
    views: Awaited<ReturnType<typeof prisma.databaseView.findMany>>;
    contextEntry: Awaited<ReturnType<typeof prisma.contextEntry.findFirst>>;
  }> {
    // Permission check (mutating operation: creates a Database)
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    // Verify parentEntryId ownership if provided
    if (input.parentEntryId) {
      const parent = await prisma.contextEntry.findFirst({
        where: { id: input.parentEntryId, userId, workspaceId },
      });
      if (!parent) throw new Error("Parent entry not found");
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the ContextEntry of type DATABASE
      const entry = await tx.contextEntry.create({
        data: {
          userId,
          workspaceId,
          title: input.name,
          content: "",
          type: "DATABASE",
        },
      });

      // 2. Create the Database row
      const database = await tx.database.create({
        data: {
          userId,
          workspaceId,
          contextEntryId: entry.id,
        },
      });

      // 3. Create the primary "Name" TEXT field
      const primaryField = await tx.databaseField.create({
        data: {
          userId,
          workspaceId,
          databaseId: database.id,
          name: "Name",
          type: "TEXT",
          position: 0,
          config: { type: "TEXT" },
          isPrimary: true,
        },
      });

      // 4. Create the default Table view
      const defaultView = await tx.databaseView.create({
        data: {
          userId,
          workspaceId,
          databaseId: database.id,
          name: "Table",
          type: "TABLE",
          position: 0,
          config: { type: "TABLE" },
        },
      });

      // 5. Set the defaultViewId on the Database
      const updatedDatabase = await tx.database.update({
        where: { id: database.id },
        data: { defaultViewId: defaultView.id },
        include: {
          contextEntry: true,
        },
      });

      return {
        database: updatedDatabase,
        fields: [primaryField],
        views: [defaultView],
        contextEntry: entry,
      };
    });

    return {
      database: result.database,
      fields: result.fields,
      views: result.views,
      contextEntry: result.contextEntry,
    };
  },

  /**
   * Get a database by ID with fields ordered by position, views ordered by
   * position, and the backing contextEntry.
   * Returns null if not found or wrong owner.
   */
  async getById(userId: string, workspaceId: string, databaseId: string) {
    return prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
      include: {
        fields: { orderBy: { position: "asc" } },
        views: { orderBy: { position: "asc" } },
        contextEntry: {
          select: {
            id: true,
            title: true,
            type: true,
            categoryId: true,
            tags: true,
            isPinned: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  },

  /**
   * Get a database by its backing ContextEntry ID. Used by the detail panel
   * when only the entry ID is known. Returns same shape as getById.
   */
  async getByEntryId(userId: string, workspaceId: string, entryId: string) {
    return prisma.database.findFirst({
      where: { contextEntryId: entryId, userId, workspaceId },
      include: {
        fields: { orderBy: { position: "asc" } },
        views: { orderBy: { position: "asc" } },
        contextEntry: {
          select: {
            id: true,
            title: true,
            type: true,
            categoryId: true,
            tags: true,
            isPinned: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  },

  /**
   * List all databases for the user with field count, row count, and view count.
   * Ordered by updatedAt descending.
   */
  async list(userId: string, workspaceId: string) {
    return prisma.database.findMany({
      where: { userId, workspaceId },
      include: {
        contextEntry: {
          select: { id: true, title: true, categoryId: true, isPinned: true },
        },
        _count: {
          select: { fields: true, rows: true, views: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  /**
   * Update a database: rename (via ContextEntry.title) or change defaultViewId.
   * Verifies ownership before updating.
   */
  async update(
    userId: string,
    workspaceId: string,
    databaseId: string,
    data: UpdateDatabaseInput,
  ) {
    // Permission check (mutating operation)
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    const existing = await prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
    });
    if (!existing) throw new Error("Database not found");

    // If defaultViewId is provided, verify the view belongs to this database
    if (data.defaultViewId) {
      const view = await prisma.databaseView.findFirst({
        where: { id: data.defaultViewId, databaseId, userId, workspaceId },
      });
      if (!view) throw new Error("View not found in this database");
    }

    // Rename updates ContextEntry.title (the entry IS the database name)
    if (data.name) {
      await prisma.contextEntry.update({
        where: { id: existing.contextEntryId },
        data: { title: data.name },
      });
    }

    // Update defaultViewId if provided
    if (data.defaultViewId) {
      await prisma.database.update({
        where: { id: databaseId },
        data: { defaultViewId: data.defaultViewId },
      });
    }

    // Return the fresh database with includes
    return prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
      include: {
        fields: { orderBy: { position: "asc" } },
        views: { orderBy: { position: "asc" } },
        contextEntry: {
          select: {
            id: true,
            title: true,
            type: true,
            categoryId: true,
            tags: true,
            isPinned: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  },

  /**
   * Delete a database. In a single transaction:
   * 1. Get all field IDs belonging to this database.
   * 2. Bulk-delete ContextLink rows where databaseFieldId IN (fieldIds) — DZ-16.
   * 3. Delete the ContextEntry (which cascades to Database, Fields, Rows, Views).
   *
   * The cascade chain: ContextEntry → (Database via contextEntryId FK CASCADE),
   * then Database → (Fields, Rows, Views via databaseId FK CASCADE).
   * Also ContextEntry → (DatabaseRow via contextEntryId FK CASCADE) for row entries.
   */
  async delete(userId: string, workspaceId: string, databaseId: string): Promise<{ id: string }> {
    // Permission check (mutating operation: deletes a Database)
    await permissionService.assertCanPerform(userId, workspaceId, "DELETE_NODE");

    const existing = await prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
      select: { id: true, contextEntryId: true },
    });
    if (!existing) throw new Error("Database not found");

    await prisma.$transaction(async (tx) => {
      // 1. Get all field IDs
      const fields = await tx.databaseField.findMany({
        where: { databaseId, userId, workspaceId },
        select: { id: true },
      });
      const fieldIds = fields.map((f) => f.id);

      // 2. DZ-16: Bulk-delete ContextLink rows for RELATION fields
      //    Defense-in-depth: workspaceId guard on raw SQL (DZ-16)
      if (fieldIds.length > 0) {
        await tx.$queryRaw`
          DELETE FROM "ContextLink"
          WHERE "databaseFieldId" IN (${Prisma.join(fieldIds)})
            AND "userId" = ${userId}
            AND "workspaceId" = ${workspaceId}
        `;
      }

      // 3. Delete all row ContextEntries (which cascades to DatabaseRow)
      // Row entries are type RECORD with a DatabaseRow pointing to this database
      const rows = await tx.databaseRow.findMany({
        where: { databaseId, userId, workspaceId },
        select: { contextEntryId: true },
      });
      const rowEntryIds = rows.map((r) => r.contextEntryId);
      if (rowEntryIds.length > 0) {
        await tx.contextEntry.deleteMany({
          where: { id: { in: rowEntryIds }, userId, workspaceId },
        });
      }

      // 4. Delete the database's ContextEntry (cascades to Database via FK)
      await tx.contextEntry.delete({
        where: { id: existing.contextEntryId },
      });
    });

    return { id: databaseId };
  },
};
