import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import type { CreateGoalInput, UpdateGoalInput, GoalFilters, AddProgressInput, ReorderGoalsInput } from "@/lib/validations";
import { validateHierarchy, recalcParentProgress } from "@/lib/services/hierarchy-helpers";
import { gamificationService } from "@/lib/services/gamification-service";
import { goalRecurringService } from "@/lib/services/goal-recurring-service";

// A Prisma client suitable for either standalone use or inside an
// interactive transaction. Service methods that perform multiple
// dependent writes accept this so callers can wrap the whole flow in
// a single $transaction without forcing a refactor of every service.
type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export const goalService = {
  /**
   * List goals for a user with optional filters.
   * Ordered by sortOrder ascending, then createdAt descending.
   */
  async list(
    userId: string,
    filters?: GoalFilters,
    pagination?: { skip?: number; take?: number },
  ) {
    return prisma.goal.findMany({
      where: {
        userId,
        ...(filters?.horizon && { horizon: filters.horizon }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.priority && { priority: filters.priority }),
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.parentId !== undefined && { parentId: filters.parentId }),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { category: true },
      ...(pagination?.skip != null && { skip: pagination.skip }),
      ...(pagination?.take != null && { take: pagination.take }),
    });
  },

  /**
   * Create a new goal. Validates hierarchy rules if parentId is provided.
   */
  async create(userId: string, data: CreateGoalInput) {
    if (data.parentId) {
      await validateHierarchy(userId, data.parentId, data.horizon);
    }

    return prisma.goal.create({
      data: {
        ...data,
        userId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
      },
    });
  },

  /**
   * Get a single goal by ID with its category, children, and parent.
   * Returns null if not found or not owned by the user.
   */
  async getById(userId: string, id: string) {
    return prisma.goal.findFirst({
      where: { id, userId },
      include: {
        category: true,
        children: {
          orderBy: { sortOrder: "asc" },
        },
        parent: true,
      },
    });
  },

  /**
   * Update a goal. Always verifies ownership before mutating.
   * Re-validates hierarchy if parentId or horizon is changing.
   *
   * Accepts an optional Prisma client so callers inside an interactive
   * transaction (e.g. completeWithSideEffects) can thread the tx
   * through.
   */
  async update(
    userId: string,
    id: string,
    data: UpdateGoalInput,
    client: PrismaClientLike = prisma,
  ) {
    const existing = await client.goal.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Goal not found");

    if (data.parentId !== undefined || data.horizon) {
      const newParentId = data.parentId === undefined ? existing.parentId : data.parentId;
      const newHorizon = data.horizon ?? existing.horizon;

      if (newParentId) {
        await validateHierarchy(userId, newParentId, newHorizon);
      }
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.deadline) updateData.deadline = new Date(data.deadline);

    // Set completedAt when status transitions to COMPLETED
    if (data.status === "COMPLETED") {
      updateData.completedAt = new Date();
    }

    const updated = await client.goal.update({
      where: { id },
      data: updateData,
    });

    // If status changed on a goal with a parent, recalculate parent progress.
    if (data.status && updated.parentId) {
      await recalcParentProgress(userId, id, client);
    }

    return updated;
  },

  /**
   * Complete a goal with all side effects atomically:
   *   1. goalService.update with the incoming patch (usually status:COMPLETED)
   *   2. gamificationService.awardXp (XpEvent + UserStats + level + weekly score)
   *   3. goalRecurringService.completeRecurringInstance if this is a recurring
   *      instance (template streak + longestStreak bookkeeping)
   *
   * Every write runs inside a single prisma.$transaction so a mid-flow
   * failure rolls back goal state, XP, and streak together. Mirrors the
   * todoService.complete contract introduced by H1/H3.
   *
   * The caller (PATCH route or MCP tool) is responsible for deciding
   * whether the goal is actually transitioning to COMPLETED for the
   * first time; this method does not re-check "was already completed"
   * because the callers often want the update to apply unconditionally.
   */
  async completeWithSideEffects(
    userId: string,
    id: string,
    data: UpdateGoalInput,
  ) {
    return prisma.$transaction(async (tx) => {
      // Read the existing goal before the update so we have the
      // correct horizon + priority for the XP calculation and the
      // recurringSourceId to decide whether to bump a streak.
      const existing = await tx.goal.findFirst({ where: { id, userId } });
      if (!existing) throw new Error("Goal not found");

      // 1. Apply the update inside the transaction.
      const goal = await goalService.update(userId, id, data, tx);

      // 2. Award XP using the pre-update horizon/priority so the
      // source string is stable even if the caller patched them.
      const xpResult = await gamificationService.awardXp(
        userId,
        id,
        existing.horizon,
        existing.priority,
        tx,
      );

      // 3. Bump the recurring template streak if this instance belongs
      // to one.
      let streakResult = null;
      if (existing.recurringSourceId) {
        streakResult = await goalRecurringService.completeRecurringInstance(
          userId,
          id,
          tx,
        );
      }

      // 4. Recalculate parent progress up the hierarchy.
      await recalcParentProgress(userId, id, tx);

      return {
        ...goal,
        _xp: xpResult,
        ...(streakResult && { _streak: streakResult }),
      };
    });
  },

  /**
   * Delete a goal. Children get parentId set to null via onDelete: SetNull.
   */
  async delete(userId: string, id: string) {
    const goal = await prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw new Error("Goal not found");

    return prisma.goal.delete({ where: { id } });
  },

  /**
   * Recursively delete a goal and all of its descendants (depth-first).
   * Used by the MCP `delete_goal` tool when `cascade: true` is passed.
   * Each recursive call re-verifies ownership via findFirst({id, userId}).
   */
  async deleteCascade(userId: string, id: string): Promise<void> {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: { children: { select: { id: true } } },
    });
    if (!goal) throw new Error("Goal not found");

    for (const child of goal.children) {
      await goalService.deleteCascade(userId, child.id);
    }
    await prisma.goal.delete({ where: { id } });
  },

  /**
   * Get the full goal tree for a user.
   * Fetches all top-level goals (no parent) with nested children 3 levels deep.
   */
  async getTree(userId: string) {
    return prisma.goal.findMany({
      where: { userId, parentId: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        category: true,
        children: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          include: {
            category: true,
            children: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
              include: {
                category: true,
                children: {
                  orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
                  include: { category: true },
                },
              },
            },
          },
        },
      },
    });
  },

  /**
   * Search goals by title or description (case insensitive).
   */
  async search(userId: string, query: string) {
    return prisma.goal.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { category: true },
    });
  },

  /**
   * Log progress for a goal. Creates a ProgressLog entry and updates
   * the goal's currentValue. Recalculates progress percentage if
   * targetValue exists. Accepts an optional Prisma client so callers
   * can run the read + two writes inside an interactive $transaction.
   */
  async logProgress(
    userId: string,
    goalId: string,
    data: AddProgressInput,
    client: PrismaClientLike = prisma,
  ) {
    const goal = await client.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new Error("Goal not found");

    const log = await client.progressLog.create({
      data: {
        goalId,
        value: data.value,
        note: data.note,
      },
    });

    const newCurrentValue = (goal.currentValue ?? 0) + data.value;
    const updateData: Record<string, unknown> = { currentValue: newCurrentValue };

    if (goal.targetValue && goal.targetValue > 0) {
      updateData.progress = Math.min(
        100,
        Math.round((newCurrentValue / goal.targetValue) * 100),
      );
    }

    await client.goal.update({
      where: { id: goalId },
      data: updateData,
    });

    return log;
  },

  /**
   * Reverse a previously logged progress entry. Best-effort match: finds
   * the most recent ProgressLog with the same value (and note, if given)
   * for this goal and deletes it, then decrements the goal's currentValue
   * and recomputes progress. Used by todoService.uncomplete to undo the
   * goal-progress side effect of a completed todo.
   *
   * Accepts an optional Prisma client to participate in a transaction.
   */
  async reverseProgress(
    userId: string,
    goalId: string,
    value: number,
    note: string | null = null,
    client: PrismaClientLike = prisma,
  ) {
    const goal = await client.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new Error("Goal not found");

    // Find the most recent matching log. If no match, still decrement the
    // counter (the log may have been pruned but the value should reverse).
    const matchingLogs = await client.progressLog.findMany({
      where: {
        goalId,
        value,
        ...(note !== null ? { note } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    if (matchingLogs.length > 0) {
      await client.progressLog.delete({ where: { id: matchingLogs[0].id } });
    }

    const newCurrentValue = Math.max(0, (goal.currentValue ?? 0) - value);
    const updateData: Record<string, unknown> = { currentValue: newCurrentValue };

    if (goal.targetValue && goal.targetValue > 0) {
      updateData.progress = Math.min(
        100,
        Math.round((newCurrentValue / goal.targetValue) * 100),
      );
    }

    await client.goal.update({
      where: { id: goalId },
      data: updateData,
    });
  },

  /**
   * Batch update sortOrder for multiple goals in a single transaction.
   * The where clause includes userId to ensure users can only reorder their own goals.
   */
  async reorderGoals(userId: string, items: ReorderGoalsInput["items"]) {
    await prisma.$transaction(
      items.map(({ id, sortOrder }) =>
        prisma.goal.update({
          where: { id, userId },
          data: { sortOrder },
        })
      )
    );
  },

  /**
   * Get goals with deadlines within a date range.
   * Excludes completed and abandoned goals. Ordered by deadline ascending.
   */
  async getByDeadlineRange(userId: string, start: Date, end: Date) {
    return prisma.goal.findMany({
      where: {
        userId,
        deadline: { gte: start, lte: end },
        status: { notIn: ["COMPLETED", "ABANDONED"] },
      },
      orderBy: { deadline: "asc" },
      select: {
        id: true,
        title: true,
        horizon: true,
        priority: true,
        deadline: true,
        status: true,
        category: true,
      },
    });
  },

  /**
   * Get all progress log entries for a goal, ordered by most recent first.
   */
  async getProgressHistory(userId: string, goalId: string) {
    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new Error("Goal not found");

    return prisma.progressLog.findMany({
      where: { goalId },
      orderBy: { createdAt: "desc" },
    });
  },
};
