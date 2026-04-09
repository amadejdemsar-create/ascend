import { prisma } from "@/lib/db";
import type { CreateTodoInput, UpdateTodoInput, TodoFilters } from "@/lib/validations";
import { goalService } from "@/lib/services/goal-service";
import { XP_PER_TODO, levelFromXp } from "@/lib/constants";
import { startOfWeek } from "date-fns";

export const todoService = {
  /**
   * List to-dos for a user with optional filters.
   * Supports status, priority, categoryId, goalId, date range, and isBig3 filters.
   * Ordered by sortOrder ascending, then createdAt descending.
   */
  async list(
    userId: string,
    filters?: TodoFilters,
    pagination?: { skip?: number; take?: number },
  ) {
    const where: Record<string, unknown> = { userId };

    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.goalId) where.goalId = filters.goalId;

    if (filters?.dateFrom || filters?.dateTo) {
      const dueDate: Record<string, Date> = {};
      if (filters.dateFrom) dueDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) dueDate.lte = new Date(filters.dateTo);
      where.dueDate = dueDate;
    }

    if (filters?.isBig3 !== undefined) {
      where.isBig3 = filters.isBig3 === "true";
    }

    return prisma.todo.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        category: true,
        goal: { select: { id: true, title: true, progress: true, targetValue: true } },
      },
      ...(pagination?.skip != null && { skip: pagination.skip }),
      ...(pagination?.take != null && { take: pagination.take }),
    });
  },

  /**
   * Create a new to-do. Validates goalId and categoryId belong to the user if provided.
   */
  async create(userId: string, data: CreateTodoInput) {
    if (data.goalId) {
      const goal = await prisma.goal.findFirst({
        where: { id: data.goalId, userId },
      });
      if (!goal) throw new Error("Goal not found");
    }

    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) throw new Error("Category not found");
    }

    return prisma.todo.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        goalId: data.goalId,
        categoryId: data.categoryId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      },
    });
  },

  /**
   * Get a single to-do by ID with its category and goal.
   * Returns null if not found or not owned by the user.
   */
  async getById(userId: string, id: string) {
    return prisma.todo.findFirst({
      where: { id, userId },
      include: {
        category: true,
        goal: { select: { id: true, title: true, progress: true, targetValue: true, currentValue: true } },
      },
    });
  },

  /**
   * Update a to-do. Verifies ownership before updating.
   */
  async update(userId: string, id: string, data: UpdateTodoInput) {
    const existing = await prisma.todo.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Todo not found");

    const updateData: Record<string, unknown> = { ...data };
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);
    if (data.big3Date) updateData.big3Date = new Date(data.big3Date);

    return prisma.todo.update({
      where: { id },
      data: updateData,
    });
  },

  /**
   * Delete a to-do. Verifies ownership before deleting.
   */
  async delete(userId: string, id: string) {
    const existing = await prisma.todo.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Todo not found");

    return prisma.todo.delete({ where: { id } });
  },

  /**
   * Complete a to-do with side effects:
   * 1. Sets status to DONE and completedAt timestamp
   * 2. Awards XP based on priority (creates XpEvent, updates UserStats)
   * 3. Auto-increments linked goal progress if goalId is set
   *
   * Returns the completed to-do with _xp metadata.
   */
  async complete(userId: string, id: string) {
    const todo = await prisma.todo.findFirst({
      where: { id, userId },
      include: { goal: true },
    });
    if (!todo) throw new Error("Todo not found");
    if (todo.status === "DONE") throw new Error("Todo already completed");

    // 1. Update the to-do status
    const completed = await prisma.todo.update({
      where: { id },
      data: {
        status: "DONE",
        completedAt: new Date(),
      },
    });

    // 2. Award XP
    const xpAmount = XP_PER_TODO[todo.priority] ?? 10;
    const source = `todo_complete:${todo.priority}`;

    await prisma.xpEvent.create({
      data: {
        userId,
        amount: xpAmount,
        source,
        goalId: todo.goalId,
      },
    });

    // Upsert UserStats: increment totalXp
    const stats = await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        totalXp: xpAmount,
        level: levelFromXp(xpAmount) || 1,
        weeklyScore: xpAmount,
        weekStartDate: startOfWeek(new Date(), { weekStartsOn: 1 }),
      },
      update: {
        totalXp: { increment: xpAmount },
      },
    });

    // Check weekly score reset
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const needsWeeklyReset = !stats.weekStartDate ||
      stats.weekStartDate.getTime() < currentWeekStart.getTime();

    const newWeeklyScore = needsWeeklyReset ? xpAmount : stats.weeklyScore + xpAmount;
    const newLevel = levelFromXp(stats.totalXp) || 1;

    await prisma.userStats.update({
      where: { userId },
      data: {
        level: newLevel,
        weeklyScore: newWeeklyScore,
        weekStartDate: needsWeeklyReset ? currentWeekStart : stats.weekStartDate ?? currentWeekStart,
      },
    });

    // 3. Auto-increment linked goal progress
    if (todo.goalId) {
      await goalService.logProgress(userId, todo.goalId, {
        value: 1,
        note: `Completed to-do: ${todo.title}`,
      });
    }

    return {
      ...completed,
      _xp: { amount: xpAmount, source },
    };
  },

  /**
   * Skip a to-do. Sets status to SKIPPED without awarding XP or incrementing goal progress.
   */
  async skip(userId: string, id: string) {
    const todo = await prisma.todo.findFirst({ where: { id, userId } });
    if (!todo) throw new Error("Todo not found");
    if (todo.status === "SKIPPED") throw new Error("Todo already skipped");

    return prisma.todo.update({
      where: { id },
      data: {
        status: "SKIPPED",
        completedAt: new Date(),
      },
    });
  },

  /**
   * Search to-dos by title or description (case insensitive).
   */
  async search(userId: string, query: string) {
    return prisma.todo.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        category: true,
        goal: { select: { id: true, title: true } },
      },
    });
  },
};
