import { prisma } from "@/lib/db";
import type {
  ContextLink,
  ContextLinkSource,
  ContextLinkType,
} from "../../generated/prisma/client";
import { edgeEventService } from "@/lib/services/edge-event-service";
import { permissionService } from "@/lib/services/permission-service";
import { activityEventService } from "@/lib/services/activity-event-service";

/**
 * Service for typed context link (edge) CRUD.
 *
 * Every method scopes by userId. The userId column on ContextLink is
 * denormalized specifically to enforce the multi-tenant boundary without
 * requiring a JOIN to ContextEntry on every query.
 *
 * Content-source links are auto-managed by syncContentLinks (called from
 * contextService.create / update after parsing wikilinks). Manual-source
 * links are created/deleted directly by the user via the detail panel.
 */
export const contextLinkService = {
  /**
   * List links filtered by from-entry, to-entry, or both. Scoped by userId.
   * Both endpoints joined into the result for UI rendering.
   */
  async list(
    userId: string,
    workspaceId: string,
    filters: { fromEntryId?: string; toEntryId?: string } = {},
  ) {
    return prisma.contextLink.findMany({
      where: {
        userId,
        workspaceId,
        ...(filters.fromEntryId && { fromEntryId: filters.fromEntryId }),
        ...(filters.toEntryId && { toEntryId: filters.toEntryId }),
      },
      include: {
        fromEntry: { select: { id: true, title: true } },
        toEntry: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Split view for an entry's detail panel: outgoing (from this entry to
   * others) and incoming (from others to this entry). Both scoped by
   * userId; the entry must belong to the user.
   */
  async listForEntry(
    userId: string,
    workspaceId: string,
    entryId: string,
  ): Promise<{
    outgoing: Array<
      ContextLink & { toEntry: { id: string; title: string; type: string } }
    >;
    incoming: Array<
      ContextLink & {
        fromEntry: { id: string; title: string; type: string };
      }
    >;
  }> {
    const [outgoing, incoming] = await Promise.all([
      prisma.contextLink.findMany({
        where: { userId, workspaceId, fromEntryId: entryId },
        include: {
          toEntry: { select: { id: true, title: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contextLink.findMany({
        where: { userId, workspaceId, toEntryId: entryId },
        include: {
          fromEntry: { select: { id: true, title: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { outgoing, incoming };
  },

  /**
   * Create a typed link. Verifies both endpoint entries belong to userId.
   * Upserts on the composite unique (fromEntryId, toEntryId, type);
   * same-type duplicates return the existing row instead of erroring.
   * Manual links default source=MANUAL.
   */
  async create(
    userId: string,
    workspaceId: string,
    input: {
      fromEntryId: string;
      toEntryId: string;
      type: ContextLinkType;
      source?: ContextLinkSource;
    },
  ): Promise<ContextLink> {
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    // Verify both endpoints belong to the user in this workspace
    const [from, to] = await Promise.all([
      prisma.contextEntry.findFirst({
        where: { id: input.fromEntryId, userId, workspaceId },
        select: { id: true },
      }),
      prisma.contextEntry.findFirst({
        where: { id: input.toEntryId, userId, workspaceId },
        select: { id: true },
      }),
    ]);
    if (!from || !to)
      throw new Error("One or both entries not found for this user");

    const link = await prisma.contextLink.upsert({
      where: {
        fromEntryId_toEntryId_type: {
          fromEntryId: input.fromEntryId,
          toEntryId: input.toEntryId,
          type: input.type,
        },
      },
      update: {}, // no-op: return existing row unchanged
      create: {
        userId,
        workspaceId,
        fromEntryId: input.fromEntryId,
        toEntryId: input.toEntryId,
        type: input.type,
        source: input.source ?? "MANUAL",
      },
    });

    // Wave 7: fire-and-forget edge event log (self-catching inside edgeEventService)
    void edgeEventService.logCreated(userId, workspaceId, link);

    // Wave 8b: fetch titles for the activity event payload.
    // The endpoint entries were already verified above (userId + workspaceId scoped);
    // we just need the title field. Fire-and-forget pattern preserved.
    void (async () => {
      try {
        const [fromEntry, toEntry] = await Promise.all([
          prisma.contextEntry.findFirst({
            where: { id: link.fromEntryId, userId, workspaceId },
            select: { title: true },
          }),
          prisma.contextEntry.findFirst({
            where: { id: link.toEntryId, userId, workspaceId },
            select: { title: true },
          }),
        ]);
        void activityEventService.log(workspaceId, userId, "LINK_CREATED", {
          eventType: "LINK_CREATED",
          linkType: link.type,
          fromEntryId: link.fromEntryId,
          toEntryId: link.toEntryId,
          fromTitle: fromEntry?.title ?? "Unknown",
          toTitle: toEntry?.title ?? "Unknown",
        });
      } catch {
        // Fall back to logging without titles rather than losing the event
        void activityEventService.log(workspaceId, userId, "LINK_CREATED", {
          eventType: "LINK_CREATED",
          linkType: link.type,
          fromEntryId: link.fromEntryId,
          toEntryId: link.toEntryId,
        });
      }
    })();

    return link;
  },

  /**
   * Update the relation type on an existing link. Existence-and-ownership
   * check. Keeps source/createdAt unchanged.
   */
  async update(
    userId: string,
    workspaceId: string,
    id: string,
    data: { type: ContextLinkType },
  ): Promise<ContextLink> {
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    const existing = await prisma.contextLink.findFirst({
      where: { id, userId, workspaceId },
    });
    if (!existing) throw new Error("Context link not found");

    const updated = await prisma.contextLink.update({
      where: { id },
      data: { type: data.type },
    });

    // Wave 7: fire-and-forget edge event log (self-catching inside edgeEventService)
    void edgeEventService.logUpdated(userId, workspaceId, existing, updated);

    return updated;
  },

  /**
   * Delete a link. If the link has source=CONTENT and !options.force, throw
   * an error guiding the user to edit content instead. If MANUAL or
   * force=true, delete and return void.
   */
  async delete(
    userId: string,
    workspaceId: string,
    id: string,
    options?: { force?: boolean },
  ): Promise<void> {
    await permissionService.assertCanPerform(userId, workspaceId, "DELETE_NODE");

    const existing = await prisma.contextLink.findFirst({
      where: { id, userId, workspaceId },
    });
    if (!existing) throw new Error("Context link not found");

    if (existing.source === "CONTENT" && !options?.force) {
      throw new Error(
        "Cannot delete content-derived link; edit entry content to remove the wikilink.",
      );
    }

    // Wave 8b: capture titles BEFORE deleting the link. The entries persist
    // (only the edge is removed), so we can safely query them here.
    // Both queries are userId + workspaceId scoped per Safety Rule 1.
    const [fromEntry, toEntry] = await Promise.all([
      prisma.contextEntry.findFirst({
        where: { id: existing.fromEntryId, userId, workspaceId },
        select: { title: true },
      }),
      prisma.contextEntry.findFirst({
        where: { id: existing.toEntryId, userId, workspaceId },
        select: { title: true },
      }),
    ]);

    await prisma.contextLink.delete({ where: { id } });

    // Wave 7: fire-and-forget edge event log (self-catching inside edgeEventService)
    void edgeEventService.logRemoved(userId, workspaceId, existing);

    // Wave 8b: fire-and-forget activity event with titles (captured pre-delete)
    void activityEventService.log(workspaceId, userId, "LINK_REMOVED", {
      eventType: "LINK_REMOVED",
      linkType: existing.type,
      fromEntryId: existing.fromEntryId,
      toEntryId: existing.toEntryId,
      fromTitle: fromEntry?.title ?? "Unknown",
      toTitle: toEntry?.title ?? "Unknown",
    });
  },

  /**
   * Reconcile CONTENT-source links for a given entry against a freshly
   * parsed set of wikilinks. MANUAL-source links are NEVER touched.
   *
   * Algorithm (within a single prisma.$transaction):
   *   1. Load existing CONTENT links for fromEntryId.
   *   2. For each parsed wikilink, resolve the target entry by TITLE match
   *      (case-insensitive, exact). Skip unresolved titles.
   *   3. Build desiredSet = [(fromEntryId, resolvedToId, relation), ...].
   *   4. Delete existing CONTENT links NOT in desiredSet.
   *   5. Upsert each entry in desiredSet.
   *
   * Returns { created, updated, deleted } counts for observability.
   */
  async syncContentLinks(
    userId: string,
    workspaceId: string,
    fromEntryId: string,
    parsedLinks: Array<{ relation: ContextLinkType; title: string }>,
  ): Promise<{ created: number; updated: number; deleted: number }> {
    // Verify the source entry belongs to the user in this workspace
    const sourceEntry = await prisma.contextEntry.findFirst({
      where: { id: fromEntryId, userId, workspaceId },
      select: { id: true },
    });
    if (!sourceEntry) throw new Error("Source entry not found for this user");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Load existing CONTENT-source links from this entry
      const existingContentLinks = await tx.contextLink.findMany({
        where: { userId, workspaceId, fromEntryId, source: "CONTENT" },
      });

      // 2. Resolve parsed wikilink titles to entry IDs.
      //    Deduplicate by (title, relation) before resolving to avoid
      //    redundant DB lookups for the same wikilink appearing multiple times.
      const uniqueParsed = new Map<
        string,
        { relation: ContextLinkType; title: string }
      >();
      for (const link of parsedLinks) {
        const key = `${link.relation}::${link.title.toLowerCase()}`;
        if (!uniqueParsed.has(key)) {
          uniqueParsed.set(key, link);
        }
      }

      // Collect all unique titles for a single batch query
      const uniqueTitles = [
        ...new Set(
          Array.from(uniqueParsed.values()).map((l) => l.title.toLowerCase()),
        ),
      ];

      // Resolve titles to entries owned by the same user in this workspace (case-insensitive)
      const targetEntries =
        uniqueTitles.length > 0
          ? await tx.contextEntry.findMany({
              where: {
                userId,
                workspaceId,
                title: { in: uniqueTitles, mode: "insensitive" },
              },
              select: { id: true, title: true },
            })
          : [];

      // Build a lowercase-title-to-id map for O(1) lookup
      const titleToId = new Map<string, string>();
      for (const entry of targetEntries) {
        titleToId.set(entry.title.toLowerCase(), entry.id);
      }

      // 3. Build desired set: resolved (toEntryId, type) pairs
      const desiredSet = new Map<string, { toEntryId: string; type: ContextLinkType }>();
      for (const parsed of uniqueParsed.values()) {
        const toEntryId = titleToId.get(parsed.title.toLowerCase());
        if (!toEntryId) continue; // Skip unresolved titles
        if (toEntryId === fromEntryId) continue; // Skip self-links

        const key = `${toEntryId}::${parsed.relation}`;
        desiredSet.set(key, { toEntryId, type: parsed.relation });
      }

      // 4. Compute diff against existing CONTENT links
      const existingKeys = new Set<string>();
      for (const link of existingContentLinks) {
        existingKeys.add(`${link.toEntryId}::${link.type}`);
      }

      const desiredKeys = new Set(desiredSet.keys());

      // Links to delete: exist in DB but not in desired set
      const toDelete = existingContentLinks.filter(
        (link) => !desiredKeys.has(`${link.toEntryId}::${link.type}`),
      );

      // Links to create: in desired set but not in DB
      const toCreate = Array.from(desiredSet.entries()).filter(
        ([key]) => !existingKeys.has(key),
      );

      // Links to update: exist in both (type match means no update needed;
      // but if a wikilink changed from [[references:X]] to [[supports:X]],
      // the old (toEntryId, REFERENCES) gets deleted and (toEntryId, SUPPORTS)
      // gets created. The composite unique ensures correctness.)
      // For true upserts where the same (from, to, type) triple exists, no
      // update is needed since the relation type is part of the unique key.

      // 5. Execute deletes
      if (toDelete.length > 0) {
        await tx.contextLink.deleteMany({
          where: {
            id: { in: toDelete.map((l) => l.id) },
            userId, // defensive: scope by userId even in delete
          },
        });
      }

      // 6. Execute creates via upsert to handle race conditions gracefully
      const createdLinks: ContextLink[] = [];
      for (const [, desired] of toCreate) {
        const link = await tx.contextLink.upsert({
          where: {
            fromEntryId_toEntryId_type: {
              fromEntryId,
              toEntryId: desired.toEntryId,
              type: desired.type,
            },
          },
          update: {}, // no-op if already exists (e.g., manual link with same type)
          create: {
            userId,
            workspaceId,
            fromEntryId,
            toEntryId: desired.toEntryId,
            type: desired.type,
            source: "CONTENT",
          },
        });
        createdLinks.push(link);
      }

      return {
        created: createdLinks.length,
        updated: 0, // Type changes are handled as delete+create via composite unique
        deleted: toDelete.length,
        _createdLinks: createdLinks,
        _deletedLinks: toDelete,
      };
    });

    // Wave 7: fire-and-forget edge events for content-sync link changes.
    // These calls are self-catching inside edgeEventService.
    for (const link of result._createdLinks) {
      void edgeEventService.logCreated(userId, workspaceId, link);
    }
    for (const link of result._deletedLinks) {
      void edgeEventService.logRemoved(userId, workspaceId, link);
    }

    return {
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
    };
  },

  /**
   * Count DERIVED_FROM links pointing TO a given entry.
   * Used by BranchDialog for the soft warning (>5 derivatives).
   */
  async countDerivatives(userId: string, workspaceId: string, entryId: string): Promise<number> {
    return prisma.contextLink.count({
      where: {
        userId,
        workspaceId,
        type: "DERIVED_FROM",
        toEntryId: entryId,
      },
    });
  },
};
