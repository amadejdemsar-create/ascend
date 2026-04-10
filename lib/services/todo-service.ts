import { prisma } from "@/lib/db";
import type { CreateTodoInput, UpdateTodoInput, TodoFilters } from "@/lib/validations";
import { goalService } from "@/lib/services/goal-service";
import { todoRecurringService } from "@/lib/services/todo-recurring-service";
import { XP_PER_TODO, levelFromXp } from "@/lib/constants";
import { startOfDay, startOfWeek } from "date-fns";

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
   * Complete a to-do with side effects, all wrapped in a single
   * interactive Prisma transaction so a mid-flow failure rolls back
   * every state change atomically:
   *   1. Set status to DONE and completedAt timestamp
   *   2. Create the XpEvent (with todoId so it can be reversed)
   *   3. Upsert + update UserStats (totalXp, level, weeklyScore)
   *   4. logProgress on the linked goal if goalId is set
   *   5. Bump the recurring template streak if this is an instance
   *
   * Returns the completed to-do with _xp metadata.
   */
  async complete(userId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const todo = await tx.todo.findFirst({
        where: { id, userId },
        include: { goal: true },
      });
      if (!todo) throw new Error("Todo not found");
      if (todo.status === "DONE") throw new Error("Todo already completed");

      // 1. Update the to-do status
      const completed = await tx.todo.update({
        where: { id },
        data: {
          status: "DONE",
          completedAt: new Date(),
        },
      });

      // 2. Award XP. Carry todoId on the event so uncomplete can find
      // and delete the originating row by foreign key.
      const xpAmount = XP_PER_TODO[todo.priority] ?? 10;
      const source = `todo_complete:${todo.priority}`;

      await tx.xpEvent.create({
        data: {
          userId,
          amount: xpAmount,
          source,
          goalId: todo.goalId,
          todoId: id,
        },
      });

      // Upsert UserStats: increment totalXp
      const stats = await tx.userStats.upsert({
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

      await tx.userStats.update({
        where: { userId },
        data: {
          level: newLevel,
          weeklyScore: newWeeklyScore,
          weekStartDate: needsWeeklyReset ? currentWeekStart : stats.weekStartDate ?? currentWeekStart,
        },
      });

      // 3. Auto-increment linked goal progress (inside the same tx)
      if (todo.goalId) {
        await goalService.logProgress(
          userId,
          todo.goalId,
          { value: 1, note: `Completed to-do: ${todo.title}` },
          tx,
        );
      }

      // 4. Update recurring streak if this is a recurring instance
      let streakResult = null;
      if (todo.recurringSourceId) {
        streakResult = await todoRecurringService.completeRecurringInstance(userId, id, tx);
      }

      return {
        ...completed,
        _xp: { amount: xpAmount, source },
        ...(streakResult && { _streak: streakResult }),
      };
    });
  },

  /**
   * Reverse a previous completion. The proper inverse of `complete`:
   *   1. Find the originating XpEvent (matched by todoId+userId) and
   *      delete it. If multiple matched (e.g., legacy event without
   *      todoId), pick the most recent.
   *   2. Decrement UserStats.totalXp by the event's amount, recompute
   *      level, and decrement weeklyScore (clamped to 0).
   *   3. Reverse the linked goal progress (deletes the matching log,
   *      decrements currentValue, recomputes progress).
   *   4. Decrement the recurring template streak (clamped to 0) and
   *      recompute consistency from the post-uncomplete state.
   *   5. Set the todo back to PENDING and clear completedAt.
   *
   * All five steps run inside a single $transaction.
   */
  async uncomplete(userId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const todo = await tx.todo.findFirst({
        where: { id, userId },
      });
      if (!todo) throw new Error("Todo not found");
      if (todo.status !== "DONE") {
        throw new Error("Todo is not in DONE state");
      }

      // 1. Find and delete the XpEvent that this completion produced.
      const xpEvent = await tx.xpEvent.findFirst({
        where: { userId, todoId: id },
        orderBy: { createdAt: "desc" },
      });

      const xpAmount = xpEvent?.amount ?? 0;
      if (xpEvent) {
        await tx.xpEvent.delete({ where: { id: xpEvent.id } });
      }

      // 2. Decrement UserStats. Clamp to zero to avoid negatives.
      const stats = await tx.userStats.findUnique({ where: { userId } });
      if (stats && xpAmount > 0) {
        const newTotalXp = Math.max(0, stats.totalXp - xpAmount);
        const newWeeklyScore = Math.max(0, stats.weeklyScore - xpAmount);
        const newLevel = levelFromXp(newTotalXp) || 1;
        await tx.userStats.update({
          where: { userId },
          data: {
            totalXp: newTotalXp,
            weeklyScore: newWeeklyScore,
            level: newLevel,
          },
        });
      }

      // 3. Reverse linked goal progress
      if (todo.goalId) {
        await goalService.reverseProgress(
          userId,
          todo.goalId,
          1,
          `Completed to-do: ${todo.title}`,
          tx,
        );
      }

      // 4. Move the todo BACK to PENDING BEFORE recomputing consistency,
      //    so the count query inside reverseRecurringInstance excludes it.
      const reverted = await tx.todo.update({
        where: { id },
        data: {
          status: "PENDING",
          completedAt: null,
        },
      });

      // 5. Decrement recurring streak if this is a recurring instance.
      if (todo.recurringSourceId) {
        await todoRecurringService.reverseRecurringInstance(userId, id, tx);
      }

      return reverted;
    });
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

  /**
   * Get Daily Big 3 to-dos for a given date (defaults to today).
   * Returns up to 3 to-dos marked as Big 3, ordered by sortOrder.
   */
  async getBig3(userId: string, date?: Date) {
    const targetDate = startOfDay(date ?? new Date());
    return prisma.todo.findMany({
      where: {
        userId,
        isBig3: true,
        big3Date: targetDate,
      },
      orderBy: { sortOrder: "asc" },
      include: {
        category: true,
        goal: { select: { id: true, title: true } },
      },
    });
  },

  /**
   * Set the Daily Big 3 for a given date. Enforces a maximum of 3 to-dos.
   *
   * Steps:
   *   1. Validate max 3 todoIds
   *   2. Verify all todoIds belong to the user
   *   3. Unset existing Big 3 for that date
   *   4. Set the new Big 3
   *   5. Return updated Big 3 to-dos
   */
  async setBig3(userId: string, todoIds: string[], date?: Date) {
    if (todoIds.length > 3) {
      throw new Error("Maximum 3 Daily Big 3 allowed");
    }

    // Verify all todoIds belong to the user
    const found = await prisma.todo.findMany({
      where: { id: { in: todoIds }, userId },
      select: { id: true },
    });

    if (found.length !== todoIds.length) {
      throw new Error("One or more to-dos not found");
    }

    const targetDate = startOfDay(date ?? new Date());

    // Unset existing Big 3 for this date
    await prisma.todo.updateMany({
      where: {
        userId,
        isBig3: true,
        big3Date: targetDate,
      },
      data: {
        isBig3: false,
        big3Date: null,
      },
    });

    // Set new Big 3. Scope by userId as defense-in-depth even though the
    // ids were already verified against the user via the findMany above.
    await prisma.todo.updateMany({
      where: {
        id: { in: todoIds },
        userId,
      },
      data: {
        isBig3: true,
        big3Date: targetDate,
      },
    });

    // Return the updated Big 3 to-dos
    return this.getBig3(userId, targetDate);
  },

  /**
   * Get all to-dos for a specific date (calendar day view).
   * Matches on scheduledDate first, or dueDate if no scheduledDate.
   * Big 3 are sorted first, then by sortOrder.
   */
  async getByDate(userId: string, date: Date) {
    const targetDate = startOfDay(date);
    return prisma.todo.findMany({
      where: {
        userId,
        OR: [
          { scheduledDate: targetDate },
          { dueDate: targetDate, scheduledDate: null },
        ],
      },
      orderBy: [{ isBig3: "desc" }, { sortOrder: "asc" }],
      include: {
        category: true,
        goal: { select: { id: true, title: true } },
      },
    });
  },

  /**
   * Get all to-dos in a date range (calendar month view).
   * Returns a flat list; the caller groups by date.
   */
  async getByDateRange(userId: string, start: Date, end: Date) {
    return prisma.todo.findMany({
      where: {
        userId,
        OR: [
          { scheduledDate: { gte: start, lte: end } },
          { dueDate: { gte: start, lte: end }, scheduledDate: null },
        ],
      },
      orderBy: [{ isBig3: "desc" }, { sortOrder: "asc" }],
      include: {
        category: true,
        goal: { select: { id: true, title: true } },
      },
    });
  },

  /**
   * Complete multiple to-dos in bulk. Wraps each in try/catch
   * so one failure does not block others.
   */
  async bulkComplete(userId: string, ids: string[]) {
    const results: Array<{ id: string; success: boolean; data?: unknown; error?: string }> = [];

    for (const id of ids) {
      try {
        const result = await this.complete(userId, id);
        results.push({ id, success: true, data: result });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },

  /**
   * Reorder to-dos by updating their sortOrder in a single transaction.
   */
  async reorder(userId: string, items: { id: string; sortOrder: number }[]) {
    await prisma.$transaction(
      items.map(({ id, sortOrder }) =>
        prisma.todo.update({
          where: { id, userId },
          data: { sortOrder },
        })
      )
    );
  },
};
