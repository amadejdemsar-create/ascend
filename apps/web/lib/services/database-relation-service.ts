/**
 * Database Relation Service.
 *
 * Manages ContextLink rows of type DATABASE_RELATION, which are created
 * by RELATION-typed fields in the database system. Each link has a
 * denormalized databaseFieldId column identifying which field produced it.
 *
 * DZ-16: Uses raw SQL for bulk deletes to avoid N×M Prisma calls.
 * DZ-8: Every query scopes by userId (denormalized on ContextLink).
 *
 * Follows the const-object service pattern.
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "../../generated/prisma/client";

export const databaseRelationService = {
  /**
   * Compute the diff between old and new relation IDs and write the
   * corresponding ContextLink rows. Uses a single transaction:
   * 1. Bulk insert new links (createMany with skipDuplicates).
   * 2. Bulk delete removed links via raw SQL (DZ-16).
   *
   * @param userId - Owner user ID (safety rule 1)
   * @param sourceEntryId - The ContextEntry ID of the source row
   * @param fieldId - The DatabaseField ID of the RELATION field
   * @param oldRelationIds - Previous set of target entry IDs
   * @param newRelationIds - New set of target entry IDs
   */
  async diffAndApply(
    userId: string,
    sourceEntryId: string,
    fieldId: string,
    oldRelationIds: string[],
    newRelationIds: string[],
  ): Promise<{ added: string[]; removed: string[] }> {
    const oldSet = new Set(oldRelationIds);
    const newSet = new Set(newRelationIds);

    const added = newRelationIds.filter((id) => !oldSet.has(id));
    const removed = oldRelationIds.filter((id) => !newSet.has(id));

    if (added.length === 0 && removed.length === 0) {
      return { added: [], removed: [] };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Bulk insert new ContextLinks
      if (added.length > 0) {
        await tx.contextLink.createMany({
          data: added.map((targetEntryId) => ({
            userId,
            fromEntryId: sourceEntryId,
            toEntryId: targetEntryId,
            type: "DATABASE_RELATION" as const,
            source: "MANUAL" as const,
            databaseFieldId: fieldId,
          })),
          skipDuplicates: true,
        });
      }

      // 2. DZ-16: Bulk delete removed links via raw SQL
      if (removed.length > 0) {
        await tx.$queryRaw`
          DELETE FROM "ContextLink"
          WHERE "databaseFieldId" = ${fieldId}
            AND "fromEntryId" = ${sourceEntryId}
            AND "toEntryId" IN (${Prisma.join(removed)})
            AND "userId" = ${userId}
        `;
      }
    });

    return { added, removed };
  },

  /**
   * Get incoming DATABASE_RELATION links for a row's entry, grouped by
   * source databaseFieldId. Returns the source database name and source
   * row info for UI rendering.
   *
   * @param userId - Owner user ID (safety rule 1)
   * @param rowEntryId - The ContextEntry ID of the target row
   */
  async getBacklinks(userId: string, rowEntryId: string) {
    const links = await prisma.contextLink.findMany({
      where: {
        toEntryId: rowEntryId,
        type: "DATABASE_RELATION",
        userId,
      },
      include: {
        fromEntry: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        databaseField: {
          select: {
            id: true,
            name: true,
            databaseId: true,
            database: {
              select: {
                id: true,
                contextEntry: {
                  select: { title: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by databaseFieldId
    const grouped = new Map<
      string,
      {
        fieldId: string;
        fieldName: string;
        databaseId: string;
        databaseName: string;
        rows: Array<{ entryId: string; title: string }>;
      }
    >();

    for (const link of links) {
      const fieldId = link.databaseFieldId ?? "unknown";
      if (!grouped.has(fieldId)) {
        grouped.set(fieldId, {
          fieldId,
          fieldName: link.databaseField?.name ?? "Unknown",
          databaseId: link.databaseField?.databaseId ?? "",
          databaseName:
            link.databaseField?.database?.contextEntry?.title ?? "Unknown",
          rows: [],
        });
      }
      grouped.get(fieldId)!.rows.push({
        entryId: link.fromEntry.id,
        title: link.fromEntry.title,
      });
    }

    return Array.from(grouped.values());
  },
};
