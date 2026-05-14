/**
 * Database Row Service.
 *
 * CRUD for DatabaseRow entities. Each row is backed by a ContextEntry of
 * type RECORD, participates in the context graph, and gets an empty
 * BlockDocument for the row's detail page.
 *
 * Transactional creates: row creation is a 3-step transaction:
 *   ContextEntry → DatabaseRow → BlockDocument.
 *
 * DZ-15: Row properties are capped at 256 KiB before write.
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import type { DatabaseFieldType } from "@/lib/validations";
import { databaseRowPropertiesSchema } from "@/lib/validations";
import { databaseRelationService } from "@/lib/services/database-relation-service";
import { versioningService } from "@/lib/services/versioning-service";
import { permissionService } from "@/lib/services/permission-service";
import { activityEventService } from "@/lib/services/activity-event-service";
import * as Y from "yjs";

// ── Constants ─────────────────────────────────────────────────────────

/** DZ-15: 256 KiB pre-flight cap on serialized properties */
const MAX_PROPERTIES_BYTES = 256 * 1024;

/** Empty Lexical snapshot for new block documents */
const EMPTY_SNAPSHOT = {
  root: {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [],
        direction: null,
        format: "",
        indent: 0,
        textFormat: 0,
        textStyle: "",
        version: 1,
      },
    ],
    direction: null,
    format: "",
    indent: 0,
    version: 1,
  },
};

// ── Service ───────────────────────────────────────────────────────────

export const databaseRowService = {
  /**
   * Create a new row in a database. Transaction:
   * 1. ContextEntry (type RECORD)
   * 2. DatabaseRow with validated properties
   * 3. BlockDocument (empty Yjs state + empty Lexical snapshot)
   *
   * After commit: if RELATION fields are populated, calls
   * databaseRelationService.diffAndApply for each.
   */
  async create(
    userId: string,
    workspaceId: string,
    databaseId: string,
    properties: Record<string, unknown> = {},
  ) {
    // Permission check (mutating operation: creates a row)
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    // Verify database ownership and fetch fields
    const database = await prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
      include: {
        fields: { orderBy: { position: "asc" } },
        contextEntry: { select: { categoryId: true } },
      },
    });
    if (!database) throw new Error("Database not found");

    // Build validation schema from fields
    const fields = database.fields.map((f) => ({
      id: f.id,
      type: f.type as DatabaseFieldType,
    }));
    const schema = databaseRowPropertiesSchema(fields);

    // Validate properties (schema allows partial objects)
    const validated = schema.parse(properties) as Record<string, unknown>;

    // DZ-15: Pre-flight 256 KiB cap
    const serialized = JSON.stringify(validated);
    if (serialized.length > MAX_PROPERTIES_BYTES) {
      throw new Error(
        `Row properties exceed 256 KiB cap (${serialized.length} bytes)`,
      );
    }

    // Derive title from the primary field value
    const primaryField = database.fields.find((f) => f.isPrimary);
    const title = primaryField
      ? String(validated[primaryField.id] ?? "")
      : "";

    // Determine position (max + 1)
    const maxRow = await prisma.databaseRow.findFirst({
      where: { databaseId, userId, workspaceId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (maxRow?.position ?? -1) + 1;

    // Build empty Yjs state
    const ydoc = new Y.Doc();
    const meta = ydoc.getMap("meta");
    meta.set("createdBy", "database-row-service");
    const yState = Y.encodeStateAsUpdate(ydoc);

    // Extract searchable text
    const extractedText = extractTextForSearch(validated, database.fields);

    // Transaction: ContextEntry + DatabaseRow + BlockDocument
    const result = await prisma.$transaction(async (tx) => {
      // 1. ContextEntry
      const entry = await tx.contextEntry.create({
        data: {
          userId,
          workspaceId,
          title: title || "Untitled",
          content: "",
          type: "RECORD",
          categoryId: database.contextEntry?.categoryId ?? null,
          extractedText: extractedText || null,
        },
      });

      // 2. DatabaseRow
      const row = await tx.databaseRow.create({
        data: {
          userId,
          workspaceId,
          databaseId,
          contextEntryId: entry.id,
          position,
          properties: validated as Prisma.InputJsonValue,
        },
      });

      // 3. BlockDocument
      const blockDoc = await tx.blockDocument.create({
        data: {
          userId,
          workspaceId,
          entryId: entry.id,
          state: Buffer.from(yState),
          snapshot: EMPTY_SNAPSHOT as unknown as Prisma.InputJsonValue,
          version: 1,
        },
      });

      // Link the block document to the entry
      await tx.contextEntry.update({
        where: { id: entry.id },
        data: { blockDocumentId: blockDoc.id },
      });

      return { row, entry, blockDoc };
    });

    // Post-commit: handle RELATION fields
    const relationFields = database.fields.filter(
      (f) => f.type === "RELATION",
    );
    for (const field of relationFields) {
      const values = validated[field.id];
      if (values && Array.isArray(values) && values.length > 0) {
        await databaseRelationService.diffAndApply(
          userId,
          workspaceId,
          result.entry.id,
          field.id,
          [],
          values as string[],
        );
      }
    }

    // Wave 8: fire-and-forget activity event
    void activityEventService.log(workspaceId, userId, "NODE_CREATED", {
      eventType: "NODE_CREATED",
      nodeType: "DATABASE_ROW",
      nodeId: result.entry.id,
      title: result.entry.title,
    });

    return result.row;
  },

  /**
   * Update a row's properties via a merge patch. Validates the patch against
   * the database's field list. Handles RELATION field diffs post-commit.
   * Updates ContextEntry.title if the primary field changed.
   */
  async update(
    userId: string,
    workspaceId: string,
    rowId: string,
    propertiesPatch: Record<string, unknown>,
  ) {
    // Permission check (mutating operation)
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    // Verify row ownership
    const existing = await prisma.databaseRow.findFirst({
      where: { id: rowId, userId, workspaceId },
      include: {
        database: {
          include: {
            fields: { orderBy: { position: "asc" } },
          },
        },
        contextEntry: { select: { title: true } },
      },
    });
    if (!existing) throw new Error("Row not found");

    const fields = existing.database.fields.map((f) => ({
      id: f.id,
      type: f.type as DatabaseFieldType,
    }));

    // Validate the patch against the dynamic schema
    const schema = databaseRowPropertiesSchema(fields);
    const validatedPatch = schema.parse(propertiesPatch) as Record<
      string,
      unknown
    >;

    // Merge into existing properties
    const existingProps = existing.properties as Record<string, unknown>;
    const merged = { ...existingProps, ...validatedPatch };

    // DZ-15: Pre-flight 256 KiB cap on merged result
    const serialized = JSON.stringify(merged);
    if (serialized.length > MAX_PROPERTIES_BYTES) {
      throw new Error(
        `Row properties exceed 256 KiB cap (${serialized.length} bytes)`,
      );
    }

    // Compute RELATION field diffs before writing
    const relationFields = existing.database.fields.filter(
      (f) => f.type === "RELATION",
    );
    const relationDiffs: Array<{
      fieldId: string;
      oldValues: string[];
      newValues: string[];
    }> = [];

    for (const field of relationFields) {
      if (!(field.id in validatedPatch)) continue;
      const oldValues = (existingProps[field.id] as string[]) ?? [];
      const newValues = (merged[field.id] as string[]) ?? [];
      relationDiffs.push({ fieldId: field.id, oldValues, newValues });
    }

    // Determine if primary field changed
    const primaryField = existing.database.fields.find((f) => f.isPrimary);
    const titleChanged =
      primaryField && primaryField.id in validatedPatch;
    const newTitle = titleChanged
      ? String(merged[primaryField!.id] ?? "") || "Untitled"
      : undefined;

    // Extract searchable text from merged properties
    const extractedText = extractTextForSearch(
      merged,
      existing.database.fields,
    );

    // Transaction: update row + contextEntry
    await prisma.$transaction(async (tx) => {
      await tx.databaseRow.update({
        where: { id: rowId },
        data: {
          properties: merged as Prisma.InputJsonValue,
        },
      });

      const entryUpdate: Prisma.ContextEntryUpdateInput = {
        extractedText: extractedText || null,
      };
      if (newTitle !== undefined) {
        entryUpdate.title = newTitle;
      }
      await tx.contextEntry.update({
        where: { id: existing.contextEntryId },
        data: entryUpdate,
      });
    });

    // Post-transaction: handle RELATION diffs
    for (const diff of relationDiffs) {
      await databaseRelationService.diffAndApply(
        userId,
        workspaceId,
        existing.contextEntryId,
        diff.fieldId,
        diff.oldValues,
        diff.newValues,
      );
    }

    // Wave 7: schedule debounced snapshot after successful update
    versioningService.scheduleSnapshot(userId, workspaceId, "DATABASE_ROW", rowId, "EDIT_DEBOUNCED");

    // Wave 8b: fire-and-forget activity event for row update.
    // Use the newTitle if primary field changed, otherwise fall back to
    // the contextEntry title that existed before the update.
    const rowTitle = newTitle ?? existing.contextEntry?.title ?? "row";
    void activityEventService.log(workspaceId, userId, "NODE_UPDATED", {
      eventType: "NODE_UPDATED",
      nodeType: "DATABASE_ROW",
      nodeId: existing.contextEntryId,
      title: rowTitle,
    });

    // Return the updated row
    return prisma.databaseRow.findFirst({
      where: { id: rowId, userId, workspaceId },
    });
  },

  /**
   * Delete a row. Cascades via ContextEntry deletion (DatabaseRow has
   * FK CASCADE from contextEntryId). BlockDocument also cascades.
   */
  async delete(userId: string, workspaceId: string, rowId: string): Promise<{ id: string }> {
    // Permission check (mutating operation: deletes a row)
    await permissionService.assertCanPerform(userId, workspaceId, "DELETE_NODE");

    const existing = await prisma.databaseRow.findFirst({
      where: { id: rowId, userId, workspaceId },
      select: { id: true, contextEntryId: true, contextEntry: { select: { title: true } } },
    });
    if (!existing) throw new Error("Row not found");

    // Wave 7: tombstone snapshot BEFORE cascade-delete so version persists
    await versioningService.createSnapshot(userId, workspaceId, "DATABASE_ROW", rowId, "EDIT_EXPLICIT");

    // Capture title before cascade-delete for the activity event
    const deletedTitle = existing.contextEntry?.title ?? "Untitled row";

    // Delete via the ContextEntry (cascades to DatabaseRow and BlockDocument)
    await prisma.contextEntry.delete({
      where: { id: existing.contextEntryId },
    });

    // Wave 8: fire-and-forget activity event (title captured pre-delete)
    void activityEventService.log(workspaceId, userId, "NODE_DELETED", {
      eventType: "NODE_DELETED",
      nodeType: "DATABASE_ROW",
      nodeId: existing.contextEntryId,
      title: deletedTitle,
    });

    return { id: rowId };
  },

  /**
   * Reorder rows manually within a database. Single transaction setting
   * position to array index for each row.
   */
  async reorderManual(
    userId: string,
    workspaceId: string,
    databaseId: string,
    orderedRowIds: string[],
  ) {
    // Permission check (mutating operation)
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    // Verify database ownership
    const database = await prisma.database.findFirst({
      where: { id: databaseId, userId, workspaceId },
    });
    if (!database) throw new Error("Database not found");

    // Validate all row IDs belong to this database
    const rows = await prisma.databaseRow.findMany({
      where: { databaseId, userId, workspaceId },
      select: { id: true },
    });
    const rowIdSet = new Set(rows.map((r) => r.id));
    for (const id of orderedRowIds) {
      if (!rowIdSet.has(id)) {
        throw new Error(`Row ${id} does not belong to this database`);
      }
    }

    // Update positions in a transaction
    await prisma.$transaction(
      orderedRowIds.map((id, index) =>
        prisma.databaseRow.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    // Return fresh ordered list
    return prisma.databaseRow.findMany({
      where: { databaseId, userId, workspaceId },
      orderBy: { position: "asc" },
    });
  },

  /**
   * Get a row by its backing ContextEntry ID. Used by the detail panel
   * to self-bootstrap when only the entry ID is known.
   * Returns the row with its parent database (fields, contextEntry).
   */
  async getByEntryId(userId: string, workspaceId: string, entryId: string) {
    return prisma.databaseRow.findFirst({
      where: { contextEntryId: entryId, userId, workspaceId },
      include: {
        database: {
          include: {
            contextEntry: { select: { id: true, title: true } },
            fields: { orderBy: { position: "asc" } },
          },
        },
      },
    });
  },
};

// ── Private helpers ───────────────────────────────────────────────────

/**
 * Extract searchable text from row properties. Joins TEXT, URL, EMAIL,
 * and PHONE field values with spaces for full-text search indexing.
 */
function extractTextForSearch(
  properties: Record<string, unknown>,
  fields: Array<{ id: string; type: string }>,
): string {
  const searchableTypes = new Set(["TEXT", "URL", "EMAIL", "PHONE"]);
  const parts: string[] = [];

  for (const field of fields) {
    if (!searchableTypes.has(field.type)) continue;
    const value = properties[field.id];
    if (typeof value === "string" && value.length > 0) {
      parts.push(value);
    }
  }

  return parts.join(" ");
}
