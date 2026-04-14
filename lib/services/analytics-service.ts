import { prisma } from "@/lib/db";
import {
  subWeeks,
  startOfWeek,
  endOfDay,
  getISOWeek,
  format,
  addWeeks,
} from "date-fns";

// --- Types ---

export interface AnalyticsTrendsData {
  weeks: number;
  todoCompletions: Array<{ week: string; weekStart: string; count: number }>;
  xpEarned: Array<{ week: string; weekStart: string; amount: number }>;
  goalProgress: Array<{
    week: string;
    weekStart: string;
    goalsProgressed: number;
  }>;
  summary: {
    todosThisWeek: number;
    todosPrevWeek: number;
    xpThisWeek: number;
    xpPrevWeek: number;
    goalsProgressedThisWeek: number;
    goalsProgressedPrevWeek: number;
  };
}

// --- Service ---

export const analyticsService = {
  /**
   * Aggregate trend data over the last N weeks for charting.
   * Runs independent Prisma queries in parallel for performance.
   */
  async getTrends(
    userId: string,
    weeks: number = 12,
  ): Promise<AnalyticsTrendsData> {
    const startDate = startOfWeek(subWeeks(new Date(), weeks), {
      weekStartsOn: 1,
    });
    const endDate = endOfDay(new Date());

    // Parallel queries: todo completions, XP events, progress logs
    const [completedTodos, xpEvents, progressLogs] = await Promise.all([
      prisma.todo.findMany({
        where: {
          userId,
          status: "DONE",
          completedAt: { gte: startDate, lte: endDate },
        },
        select: { completedAt: true },
      }),

      prisma.xpEvent.findMany({
        where: {
          userId,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { amount: true, createdAt: true },
      }),

      prisma.progressLog.findMany({
        where: {
          goal: { userId },
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { goalId: true, createdAt: true },
      }),
    ]);

    // Build week buckets ordered oldest to newest
    const bucketKeys: string[] = [];
    const bucketLabels = new Map<string, string>();
    const todoCounts = new Map<string, number>();
    const xpAmounts = new Map<string, number>();
    const goalIdSets = new Map<string, Set<string>>();

    let cursor = startDate;
    while (cursor <= endDate) {
      const key = format(cursor, "yyyy-MM-dd");
      const label = `W${getISOWeek(cursor)}`;
      bucketKeys.push(key);
      bucketLabels.set(key, label);
      todoCounts.set(key, 0);
      xpAmounts.set(key, 0);
      goalIdSets.set(key, new Set());
      cursor = addWeeks(cursor, 1);
    }

    // Helper: find the bucket key for a given date
    function bucketKeyFor(date: Date): string {
      const weekMonday = startOfWeek(date, { weekStartsOn: 1 });
      return format(weekMonday, "yyyy-MM-dd");
    }

    // Group todo completions
    for (const todo of completedTodos) {
      if (!todo.completedAt) continue;
      const key = bucketKeyFor(todo.completedAt);
      if (todoCounts.has(key)) {
        todoCounts.set(key, todoCounts.get(key)! + 1);
      }
    }

    // Group XP events
    for (const event of xpEvents) {
      const key = bucketKeyFor(event.createdAt);
      if (xpAmounts.has(key)) {
        xpAmounts.set(key, xpAmounts.get(key)! + event.amount);
      }
    }

    // Group progress logs (unique goalIds per week)
    for (const log of progressLogs) {
      const key = bucketKeyFor(log.createdAt);
      goalIdSets.get(key)?.add(log.goalId);
    }

    // Build result arrays
    const todoCompletions = bucketKeys.map((key) => ({
      week: bucketLabels.get(key)!,
      weekStart: key,
      count: todoCounts.get(key)!,
    }));

    const xpEarned = bucketKeys.map((key) => ({
      week: bucketLabels.get(key)!,
      weekStart: key,
      amount: xpAmounts.get(key)!,
    }));

    const goalProgress = bucketKeys.map((key) => ({
      week: bucketLabels.get(key)!,
      weekStart: key,
      goalsProgressed: goalIdSets.get(key)!.size,
    }));

    // Compute summary from last two entries
    const lastTodo = todoCompletions[todoCompletions.length - 1];
    const prevTodo =
      todoCompletions.length >= 2
        ? todoCompletions[todoCompletions.length - 2]
        : undefined;

    const lastXp = xpEarned[xpEarned.length - 1];
    const prevXp =
      xpEarned.length >= 2 ? xpEarned[xpEarned.length - 2] : undefined;

    const lastGoal = goalProgress[goalProgress.length - 1];
    const prevGoal =
      goalProgress.length >= 2
        ? goalProgress[goalProgress.length - 2]
        : undefined;

    const summary = {
      todosThisWeek: lastTodo?.count ?? 0,
      todosPrevWeek: prevTodo?.count ?? 0,
      xpThisWeek: lastXp?.amount ?? 0,
      xpPrevWeek: prevXp?.amount ?? 0,
      goalsProgressedThisWeek: lastGoal?.goalsProgressed ?? 0,
      goalsProgressedPrevWeek: prevGoal?.goalsProgressed ?? 0,
    };

    return {
      weeks,
      todoCompletions,
      xpEarned,
      goalProgress,
      summary,
    };
  },
};
