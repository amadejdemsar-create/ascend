import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import { startOfWeek, endOfDay } from "date-fns";
import type {
  CreateFocusSessionInput,
  FocusSessionFilters,
} from "@/lib/validations";

export const focusService = {
  /**
   * Create a focus session. If todoId is provided, denormalize the
   * linked goalId from the todo so summary queries can group by goal
   * without a join. Verifies the todo belongs to the user before
   * recording the session (multi-tenant boundary).
   */
  async create(userId: string, data: CreateFocusSessionInput) {
    let goalId: string | null = null;
    if (data.todoId) {
      const todo = await prisma.todo.findFirst({
        where: { id: data.todoId, userId },
        select: { goalId: true },
      });
      if (!todo) throw new Error("Todo not found");
      goalId = todo.goalId;
    }

    return prisma.focusSession.create({
      data: {
        userId,
        todoId: data.todoId,
        goalId,
        durationSeconds: data.durationSeconds,
        mode: data.mode,
        startedAt: new Date(data.startedAt),
        endedAt: new Date(data.endedAt),
      },
    });
  },

  /**
   * List focus sessions for a user with optional filters by todo,
   * goal, or startedAt date range. Ordered by startedAt descending
   * (most recent first).
   */
  async list(userId: string, filters?: FocusSessionFilters) {
    const where: Prisma.FocusSessionWhereInput = { userId };
    if (filters?.todoId) where.todoId = filters.todoId;
    if (filters?.goalId) where.goalId = filters.goalId;
    if (filters?.dateFrom || filters?.dateTo) {
      const startedAt: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) startedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) startedAt.lte = new Date(filters.dateTo);
      where.startedAt = startedAt;
    }
    return prisma.focusSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
    });
  },

  /**
   * Aggregate total focus time and session count for a single todo.
   * Excludes break sessions so the number reflects pure focus time.
   */
  async summaryForTodo(userId: string, todoId: string) {
    const result = await prisma.focusSession.aggregate({
      where: { userId, todoId, mode: "focus" },
      _sum: { durationSeconds: true },
      _count: { id: true },
    });
    return {
      totalSeconds: result._sum.durationSeconds ?? 0,
      sessionCount: result._count.id ?? 0,
    };
  },

  /**
   * Aggregate total focus time and session count for a single goal.
   * Sums every focus session linked (directly via goalId or via a todo
   * that belongs to the goal, which was denormalized at create time).
   */
  async summaryForGoal(userId: string, goalId: string) {
    const result = await prisma.focusSession.aggregate({
      where: { userId, goalId, mode: "focus" },
      _sum: { durationSeconds: true },
      _count: { id: true },
    });
    return {
      totalSeconds: result._sum.durationSeconds ?? 0,
      sessionCount: result._count.id ?? 0,
    };
  },

  /**
   * Aggregate total focus time and session count for the current week
   * (Monday to end of today). Used by the dashboard to surface a
   * weekly focus stat alongside XP and streaks.
   */
  async summaryForWeek(userId: string) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfDay(new Date());
    const result = await prisma.focusSession.aggregate({
      where: {
        userId,
        mode: "focus",
        startedAt: { gte: weekStart, lte: weekEnd },
      },
      _sum: { durationSeconds: true },
      _count: { id: true },
    });
    return {
      totalSeconds: result._sum.durationSeconds ?? 0,
      sessionCount: result._count.id ?? 0,
    };
  },
};
