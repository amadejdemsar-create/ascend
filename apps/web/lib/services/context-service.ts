import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import type {
  ContextEntryType,
  ContextLinkType,
} from "../../generated/prisma/client";
import type {
  CreateContextInput,
  UpdateContextInput,
  ContextFilters,
} from "@/lib/validations";
import { parseWikilinks } from "@ascend/core";
import { contextLinkService } from "@/lib/services/context-link-service";

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
   * Create a new context entry. Parses [[wikilinks]] from content via the
   * @ascend/core parser and syncs typed CONTENT-source links. Does NOT
   * write to the legacy linkedEntryIds array (dead write path as of Phase 3).
   */
  async create(userId: string, data: CreateContextInput) {
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) throw new Error("Category not found");
    }

    const entry = await prisma.contextEntry.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        categoryId: data.categoryId,
        tags: data.tags ?? [],
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    // Parse wikilinks from content and sync typed edges
    const parsed = parseWikilinks(data.content);
    if (parsed.length > 0) {
      await contextLinkService.syncContentLinks(
        userId,
        entry.id,
        parsed.map((p) => ({ relation: p.relation, title: p.title })),
      );
    }

    return entry;
  },

  /**
   * Get a single context entry by ID with ownership check.
   * Joins outgoing and incoming ContextLink edges for the detail panel.
   */
  async getById(userId: string, id: string) {
    const entry = await prisma.contextEntry.findFirst({
      where: { id, userId },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        outgoingLinks: {
          include: {
            toEntry: { select: { id: true, title: true, type: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        incomingLinks: {
          include: {
            fromEntry: { select: { id: true, title: true, type: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!entry) return null;

    return entry;
  },

  /**
   * Update a context entry. Re-parses [[wikilinks]] if content changed
   * and syncs typed CONTENT-source links via contextLinkService. Does NOT
   * write to the legacy linkedEntryIds array.
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

    // Build update payload without linkedEntryIds (dead write path)
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.type !== undefined) updateData.type = data.type;

    const updated = await prisma.contextEntry.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    // Re-parse and sync content links if content was updated
    if (data.content) {
      const parsed = parseWikilinks(data.content);
      await contextLinkService.syncContentLinks(
        userId,
        id,
        parsed.map((p) => ({ relation: p.relation, title: p.title })),
      );
    }

    return updated;
  },

  /**
   * Delete a context entry. Also removes this ID from
   * linkedEntryIds arrays of other entries that reference it.
   * ContextLinks are cascade-deleted by Prisma (onDelete: Cascade on both
   * fromEntry and toEntry relations).
   */
  async delete(userId: string, id: string) {
    const existing = await prisma.contextEntry.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new Error("Context entry not found");

    // Remove this ID from any of THIS user's entries that link to it
    // via the legacy linkedEntryIds array. Scoped by userId.
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

  // ── Graph traversal methods (Phase 3) ─────────────────────────────

  /**
   * Change an entry's type (NOTE to SOURCE, etc.). Existence + userId check.
   */
  async updateType(
    userId: string,
    id: string,
    type: ContextEntryType,
  ) {
    const existing = await prisma.contextEntry.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new Error("Context entry not found");

    return prisma.contextEntry.update({
      where: { id },
      data: { type },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });
  },

  /**
   * Filter entries by type. Used by MCP list_nodes_by_type and UI type chips.
   */
  async listByType(userId: string, type: ContextEntryType) {
    return prisma.contextEntry.findMany({
      where: { userId, type },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });
  },

  /**
   * Return the graph as { nodes, edges } for the graph view. Apply filters
   * (types, categoryId, tag). Cap at `cap` nodes (default 1000) by degree
   * so the visualization remains useful for large knowledge bases.
   */
  async getGraph(
    userId: string,
    filters?: {
      types?: ContextEntryType[];
      categoryId?: string;
      tag?: string;
      cap?: number;
    },
  ): Promise<{
    nodes: Array<{
      id: string;
      title: string;
      type: ContextEntryType;
      isPinned: boolean;
      outgoingCount: number;
      incomingCount: number;
    }>;
    edges: Array<{
      id: string;
      fromId: string;
      toId: string;
      type: ContextLinkType;
    }>;
  }> {
    const cap = filters?.cap ?? 1000;

    // Build entry filter
    const entryWhere: Prisma.ContextEntryWhereInput = { userId };
    if (filters?.types && filters.types.length > 0) {
      entryWhere.type = { in: filters.types };
    }
    if (filters?.categoryId) entryWhere.categoryId = filters.categoryId;
    if (filters?.tag) entryWhere.tags = { has: filters.tag };

    // Fetch all matching entries with link counts
    const entries = await prisma.contextEntry.findMany({
      where: entryWhere,
      select: {
        id: true,
        title: true,
        type: true,
        isPinned: true,
        _count: {
          // Defense-in-depth: filter degree counts by userId even though
          // ContextLink creation paths already enforce owner scoping on
          // both endpoints. If a future code path ever created a cross-
          // user link, this filter prevents it from inflating the visible
          // degree for either user.
          select: {
            outgoingLinks: { where: { userId } },
            incomingLinks: { where: { userId } },
          },
        },
      },
    });

    // Sort by total degree (outgoing + incoming) descending, take top `cap`
    const sorted = entries
      .map((e) => ({
        ...e,
        outgoingCount: e._count.outgoingLinks,
        incomingCount: e._count.incomingLinks,
        totalDegree: e._count.outgoingLinks + e._count.incomingLinks,
      }))
      .sort((a, b) => b.totalDegree - a.totalDegree)
      .slice(0, cap);

    const nodeIds = new Set(sorted.map((e) => e.id));

    // Shape nodes
    const nodes = sorted.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      isPinned: e.isPinned,
      outgoingCount: e.outgoingCount,
      incomingCount: e.incomingCount,
    }));

    // Fetch edges where both endpoints are in the node set
    const edges = await prisma.contextLink.findMany({
      where: {
        userId,
        fromEntryId: { in: [...nodeIds] },
        toEntryId: { in: [...nodeIds] },
      },
      select: {
        id: true,
        fromEntryId: true,
        toEntryId: true,
        type: true,
      },
    });

    return {
      nodes,
      edges: edges.map((e) => ({
        id: e.id,
        fromId: e.fromEntryId,
        toId: e.toEntryId,
        type: e.type,
      })),
    };
  },

  /**
   * BFS N-hop neighborhood around an entry. Depth is internally capped at 5
   * for safety. Returns both nodes (including the center) and edges within
   * the subgraph.
   */
  async getNeighbors(
    userId: string,
    id: string,
    depth: number,
  ): Promise<{
    nodes: Array<{
      id: string;
      title: string;
      type: ContextEntryType;
      isPinned: boolean;
    }>;
    edges: Array<{
      id: string;
      fromId: string;
      toId: string;
      type: ContextLinkType;
    }>;
  }> {
    const maxDepth = Math.min(Math.max(depth, 1), 5);

    // Verify the center entry exists and belongs to the user
    const center = await prisma.contextEntry.findFirst({
      where: { id, userId },
      select: { id: true, title: true, type: true, isPinned: true },
    });
    if (!center) throw new Error("Context entry not found");

    // BFS: expand frontier hop by hop
    const visited = new Set<string>([id]);
    let frontier = new Set<string>([id]);
    const allEdgeIds = new Set<string>();

    for (let hop = 0; hop < maxDepth; hop++) {
      if (frontier.size === 0) break;

      // Find all edges touching the current frontier (both directions)
      const [outgoing, incoming] = await Promise.all([
        prisma.contextLink.findMany({
          where: {
            userId,
            fromEntryId: { in: [...frontier] },
          },
          select: { id: true, fromEntryId: true, toEntryId: true, type: true },
        }),
        prisma.contextLink.findMany({
          where: {
            userId,
            toEntryId: { in: [...frontier] },
          },
          select: { id: true, fromEntryId: true, toEntryId: true, type: true },
        }),
      ]);

      const nextFrontier = new Set<string>();

      for (const edge of [...outgoing, ...incoming]) {
        allEdgeIds.add(edge.id);

        // Discover new nodes
        if (!visited.has(edge.toEntryId)) {
          visited.add(edge.toEntryId);
          nextFrontier.add(edge.toEntryId);
        }
        if (!visited.has(edge.fromEntryId)) {
          visited.add(edge.fromEntryId);
          nextFrontier.add(edge.fromEntryId);
        }
      }

      frontier = nextFrontier;
    }

    // Fetch full node data for all visited nodes
    const nodeData = await prisma.contextEntry.findMany({
      where: {
        userId,
        id: { in: [...visited] },
      },
      select: { id: true, title: true, type: true, isPinned: true },
    });

    // Fetch all edges that connect nodes within the visited set
    const visitedArray = [...visited];
    const subgraphEdges = await prisma.contextLink.findMany({
      where: {
        userId,
        fromEntryId: { in: visitedArray },
        toEntryId: { in: visitedArray },
      },
      select: { id: true, fromEntryId: true, toEntryId: true, type: true },
    });

    return {
      nodes: nodeData.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        isPinned: n.isPinned,
      })),
      edges: subgraphEdges.map((e) => ({
        id: e.id,
        fromId: e.fromEntryId,
        toId: e.toEntryId,
        type: e.type,
      })),
    };
  },

  /**
   * Top-20 "related" entries for a given entry, weighted heuristically:
   *   direct edge: 1.0
   *   2-hop edge: 0.5
   *   shared tag: 0.3
   *   same category: 0.2
   * Aggregated score, sorted descending, limit 20.
   */
  async getRelated(
    userId: string,
    id: string,
  ): Promise<
    Array<{
      id: string;
      title: string;
      type: ContextEntryType;
      score: number;
    }>
  > {
    // Verify the source entry exists and belongs to the user
    const source = await prisma.contextEntry.findFirst({
      where: { id, userId },
      select: { id: true, tags: true, categoryId: true },
    });
    if (!source) throw new Error("Context entry not found");

    const scores = new Map<string, number>();

    // 1. Direct edges (weight 1.0)
    const [directOutgoing, directIncoming] = await Promise.all([
      prisma.contextLink.findMany({
        where: { userId, fromEntryId: id },
        select: { toEntryId: true },
      }),
      prisma.contextLink.findMany({
        where: { userId, toEntryId: id },
        select: { fromEntryId: true },
      }),
    ]);

    const directNeighborIds = new Set<string>();
    for (const edge of directOutgoing) {
      if (edge.toEntryId !== id) {
        scores.set(edge.toEntryId, (scores.get(edge.toEntryId) ?? 0) + 1.0);
        directNeighborIds.add(edge.toEntryId);
      }
    }
    for (const edge of directIncoming) {
      if (edge.fromEntryId !== id) {
        scores.set(edge.fromEntryId, (scores.get(edge.fromEntryId) ?? 0) + 1.0);
        directNeighborIds.add(edge.fromEntryId);
      }
    }

    // 2. Two-hop edges (weight 0.5)
    if (directNeighborIds.size > 0) {
      const neighborArray = [...directNeighborIds];
      const [twoHopOut, twoHopIn] = await Promise.all([
        prisma.contextLink.findMany({
          where: {
            userId,
            fromEntryId: { in: neighborArray },
            toEntryId: { notIn: [id] },
          },
          select: { toEntryId: true },
        }),
        prisma.contextLink.findMany({
          where: {
            userId,
            toEntryId: { in: neighborArray },
            fromEntryId: { notIn: [id] },
          },
          select: { fromEntryId: true },
        }),
      ]);

      for (const edge of twoHopOut) {
        if (edge.toEntryId !== id) {
          scores.set(edge.toEntryId, (scores.get(edge.toEntryId) ?? 0) + 0.5);
        }
      }
      for (const edge of twoHopIn) {
        if (edge.fromEntryId !== id) {
          scores.set(
            edge.fromEntryId,
            (scores.get(edge.fromEntryId) ?? 0) + 0.5,
          );
        }
      }
    }

    // 3. Shared tags (weight 0.3 per shared tag)
    if (source.tags.length > 0) {
      const tagMatches = await prisma.contextEntry.findMany({
        where: {
          userId,
          id: { not: id },
          tags: { hasSome: source.tags },
        },
        select: { id: true, tags: true },
      });

      for (const entry of tagMatches) {
        const sharedCount = entry.tags.filter((t) =>
          source.tags.includes(t),
        ).length;
        scores.set(entry.id, (scores.get(entry.id) ?? 0) + 0.3 * sharedCount);
      }
    }

    // 4. Same category (weight 0.2)
    if (source.categoryId) {
      const categoryMatches = await prisma.contextEntry.findMany({
        where: {
          userId,
          id: { not: id },
          categoryId: source.categoryId,
        },
        select: { id: true },
      });

      for (const entry of categoryMatches) {
        scores.set(entry.id, (scores.get(entry.id) ?? 0) + 0.2);
      }
    }

    // Sort by score descending, take top 20
    const sortedIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([entryId]) => entryId);

    if (sortedIds.length === 0) return [];

    // Fetch full entry data for the top-20
    const entries = await prisma.contextEntry.findMany({
      where: {
        userId,
        id: { in: sortedIds },
      },
      select: { id: true, title: true, type: true },
    });

    // Re-attach scores and sort
    const entryMap = new Map(entries.map((e) => [e.id, e]));
    return sortedIds
      .map((entryId) => {
        const entry = entryMap.get(entryId);
        if (!entry) return null;
        return {
          id: entry.id,
          title: entry.title,
          type: entry.type,
          score: Math.round((scores.get(entryId) ?? 0) * 100) / 100,
        };
      })
      .filter(
        (
          e,
        ): e is {
          id: string;
          title: string;
          type: ContextEntryType;
          score: number;
        } => e !== null,
      );
  },
};
