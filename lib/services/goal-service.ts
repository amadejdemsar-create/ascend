import { prisma } from "@/lib/db";
import type { CreateGoalInput, UpdateGoalInput, GoalFilters, AddProgressInput } from "@/lib/validations";
import { validateHierarchy } from "@/lib/services/hierarchy-helpers";

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
   * Update a goal. Re-validates hierarchy if parentId or horizon is changing.
   */
  async update(userId: string, id: string, data: UpdateGoalInput) {
    if (data.parentId !== undefined || data.horizon) {
      const existing = await prisma.goal.findFirst({ where: { id, userId } });
      if (!existing) throw new Error("Goal not found");

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

    return prisma.goal.update({
      where: { id },
      data: updateData,
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
   * Get the full goal tree for a user.
   * Fetches all yearly goals with nested children 3 levels deep
   * (yearly > quarterly > monthly > weekly).
   */
  async getTree(userId: string) {
    return prisma.goal.findMany({
      where: { userId, horizon: "YEARLY", parentId: null },
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
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { category: true },
    });
  },

  /**
   * Log progress for a goal. Creates a ProgressLog entry and updates
   * the goal's currentValue. Recalculates progress percentage if targetValue exists.
   */
  async logProgress(userId: string, goalId: string, data: AddProgressInput) {
    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new Error("Goal not found");

    const log = await prisma.progressLog.create({
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

    await prisma.goal.update({
      where: { id: goalId },
      data: updateData,
    });

    return log;
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
