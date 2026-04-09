import { prisma } from "@/lib/db";
import type { CreateContextInput, UpdateContextInput, ContextFilters } from "@/lib/validations";

export const contextService = {
  /**
   * List context entries for a user with optional category/tag filters.
   * Ordered by updatedAt descending (most recently edited first).
   */
  async list(userId: string, filters?: ContextFilters) {
    const where: Record<string, unknown> = { userId };

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.tag) where.tags = { has: filters.tag };

    return prisma.contextEntry.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });
  },

  /**
   * Create a new context entry. Parses [[backlinks]] from content
   * and resolves titles to entry IDs.
   */
  async create(userId: string, data: CreateContextInput) {
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) throw new Error("Category not found");
    }

    const linkedEntryIds = await this.parseBacklinks(data.content, userId);

    return prisma.contextEntry.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        categoryId: data.categoryId,
        tags: data.tags ?? [],
        linkedEntryIds,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });
  },

  /**
   * Get a single context entry by ID with ownership check.
   * Also computes incoming backlinks (entries that link TO this entry).
   */
  async getById(userId: string, id: string) {
    const entry = await prisma.contextEntry.findFirst({
      where: { id, userId },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    if (!entry) return null;

    // Find entries that link TO this entry (incoming backlinks)
    const incomingLinks = await prisma.contextEntry.findMany({
      where: {
        userId,
        linkedEntryIds: { has: id },
      },
      select: { id: true, title: true },
    });

    return { ...entry, incomingLinks };
  },

  /**
   * Update a context entry. Re-parses [[backlinks]] if content changed.
   */
  async update(userId: string, id: string, data: UpdateContextInput) {
    const existing = await prisma.contextEntry.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new Error("Context entry not found");

    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) throw new Error("Category not found");
    }

    const updateData: Record<string, unknown> = { ...data };

    // Re-parse backlinks if content was updated
    if (data.content) {
      updateData.linkedEntryIds = await this.parseBacklinks(data.content, userId);
    }

    return prisma.contextEntry.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });
  },

  /**
   * Delete a context entry. Also removes this ID from
   * linkedEntryIds arrays of other entries that reference it.
   */
  async delete(userId: string, id: string) {
    const existing = await prisma.contextEntry.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new Error("Context entry not found");

    // Remove this ID from any entries that link to it
    await prisma.$executeRaw`
      UPDATE "ContextEntry"
      SET "linkedEntryIds" = array_remove("linkedEntryIds", ${id})
      WHERE ${id} = ANY("linkedEntryIds")
    `;

    return prisma.contextEntry.delete({ where: { id } });
  },

  /**
   * Full-text search across context entries using PostgreSQL tsvector.
   * Results are ranked by relevance (title weighted higher than content,
   * content higher than tags).
   */
  async search(userId: string, query: string) {
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        content: string;
        tags: string[];
        categoryId: string | null;
        createdAt: Date;
        updatedAt: Date;
        rank: number;
      }>
    >`
      SELECT "id", "title", "content", "tags", "categoryId", "createdAt", "updatedAt",
        ts_rank("search_vector", plainto_tsquery('english', ${query})) as rank
      FROM "ContextEntry"
      WHERE "userId" = ${userId}
        AND "search_vector" @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT 50
    `;

    return results;
  },

  /**
   * Parse [[backlinks]] from markdown content.
   * Extracts titles from [[Title]] syntax and resolves them to entry IDs
   * owned by the same user.
   */
  async parseBacklinks(content: string, userId: string): Promise<string[]> {
    const regex = /\[\[([^\]]+)\]\]/g;
    const titles: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      titles.push(match[1]);
    }

    if (titles.length === 0) return [];

    const entries = await prisma.contextEntry.findMany({
      where: {
        userId,
        title: { in: titles },
      },
      select: { id: true },
    });

    return entries.map((e) => e.id);
  },
};
