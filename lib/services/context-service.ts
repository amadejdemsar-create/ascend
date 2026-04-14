import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import type { CreateContextInput, UpdateContextInput, ContextFilters } from "@/lib/validations";

export const contextService = {
  /**
   * List context entries for a user with optional category/tag filters.
   * Ordered by updatedAt descending (most recently edited first).
   */
  async list(userId: string, filters?: ContextFilters) {
    const where: Prisma.ContextEntryWhereInput = { userId };

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.tag) where.tags = { has: filters.tag };

    return prisma.contextEntry.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
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

    // Remove this ID from any of THIS user's entries that link to it.
    // Scoped by userId so the raw UPDATE respects the multi-tenant boundary
    // even in the unlikely case of an id collision across users.
    await prisma.$executeRaw`
      UPDATE "ContextEntry"
      SET "linkedEntryIds" = array_remove("linkedEntryIds", ${id})
      WHERE "userId" = ${userId} AND ${id} = ANY("linkedEntryIds")
    `;

    return prisma.contextEntry.delete({ where: { id } });
  },

  /**
   * Toggle (or explicitly set) the pinned state of a context entry.
   * If `isPinned` is provided, uses that value; otherwise flips the current value.
   */
  async togglePin(userId: string, id: string, isPinned?: boolean) {
    const entry = await prisma.contextEntry.findFirst({ where: { id, userId } });
    if (!entry) throw new Error("Context entry not found");

    const newValue = typeof isPinned === "boolean" ? isPinned : !entry.isPinned;

    return prisma.contextEntry.update({
      where: { id },
      data: { isPinned: newValue },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });
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
   * Auto-derive a "Current Priorities" document from active goals and today's Big 3.
   * Returns dynamic content (not persisted as a ContextEntry).
   */
  async getCurrentPriorities(userId: string): Promise<{ title: string; content: string }> {
    // 1. Active goals ordered by priority desc, deadline asc
    const goals = await prisma.goal.findMany({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: [{ priority: "desc" }, { deadline: "asc" }],
      take: 10,
      select: {
        id: true,
        title: true,
        priority: true,
        progress: true,
        deadline: true,
      },
    });

    // 2. Today's Big 3 to-dos
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const big3 = await prisma.todo.findMany({
      where: {
        userId,
        isBig3: true,
        big3Date: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { priority: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        goal: { select: { title: true } },
      },
    });

    // 3. Compose markdown
    const lines: string[] = ["# Current Priorities", ""];

    // Big 3 section
    lines.push("## Today's Big 3");
    lines.push("");
    if (big3.length === 0) {
      lines.push("_No Big 3 set for today._");
    } else {
      for (const todo of big3) {
        const check = todo.status === "DONE" ? "x" : " ";
        const goalRef = todo.goal ? ` (linked to [[${todo.goal.title}]])` : "";
        lines.push(`- [${check}] ${todo.title}${goalRef}`);
      }
    }
    lines.push("");

    // Active goals section grouped by priority
    lines.push("## Active Goals");
    lines.push("");

    const priorityOrder = ["HIGH", "MEDIUM", "LOW"] as const;
    const priorityLabels: Record<string, string> = {
      HIGH: "High Priority",
      MEDIUM: "Medium Priority",
      LOW: "Low Priority",
    };

    for (const priority of priorityOrder) {
      const group = goals.filter((g) => g.priority === priority);
      if (group.length === 0) continue;

      lines.push(`### ${priorityLabels[priority]}`);
      lines.push("");
      for (const goal of group) {
        const deadlineStr = goal.deadline
          ? ` | due ${new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : "";
        lines.push(`- ${goal.title} (progress: ${goal.progress}%${deadlineStr})`);
      }
      lines.push("");
    }

    if (goals.length === 0) {
      lines.push("_No active goals._");
      lines.push("");
    }

    return { title: "Current Priorities", content: lines.join("\n") };
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
