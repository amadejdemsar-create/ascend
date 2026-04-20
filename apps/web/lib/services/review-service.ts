import { prisma } from "@/lib/db";
import { addDays, startOfDay, endOfDay, format } from "date-fns";
import { contextService } from "./context-service";
import type { SaveReviewInput } from "@/lib/validations";

// --- Types ---

export interface WeeklyReviewData {
  weekStart: string;
  weekEnd: string;
  stats: {
    todosCompleted: number;
    todosCarriedOver: number;
    goalsCompleted: number;
    goalsProgressed: number;
    xpEarned: number;
    big3Days: number;
    big3Total: number;
  };
  completedTodos: Array<{
    id: string;
    title: string;
    completedAt: string | null;
    goal: { id: string; title: string } | null;
  }>;
  carriedOverTodos: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    priority: string;
    goal: { id: string; title: string } | null;
  }>;
  goalProgressDeltas: Array<{
    id: string;
    title: string;
    progressStart: number;
    progressEnd: number;
    delta: number;
  }>;
  completedGoals: Array<{
    id: string;
    title: string;
    horizon: string;
    completedAt: string | null;
  }>;
}

// --- Service ---

export const reviewService = {
  /**
   * Aggregate weekly review data for a given week.
   * weekStart is an ISO date string (e.g. "2026-04-06").
   * Runs independent Prisma queries in parallel for performance.
   */
  async getWeeklyReview(
    userId: string,
    weekStart: string,
  ): Promise<WeeklyReviewData> {
    const weekStartDate = startOfDay(new Date(weekStart));
    const weekEnd = endOfDay(addDays(weekStartDate, 6));

    const [
      completedTodosRaw,
      carriedOverRaw,
      completedGoalsRaw,
      xpEventsRaw,
      big3Raw,
      progressLogsRaw,
    ] = await Promise.all([
      // Todos completed this week
      prisma.todo.findMany({
        where: {
          userId,
          status: "DONE",
          completedAt: { gte: weekStartDate, lte: weekEnd },
        },
        include: { goal: { select: { id: true, title: true } } },
        orderBy: { completedAt: "desc" },
      }),

      // Todos carried over (pending, due this week or earlier)
      prisma.todo.findMany({
        where: {
          userId,
          status: "PENDING",
          dueDate: { lte: weekEnd },
        },
        include: { goal: { select: { id: true, title: true } } },
        orderBy: { dueDate: "asc" },
      }),

      // Goals completed this week
      prisma.goal.findMany({
        where: {
          userId,
          status: "COMPLETED",
          completedAt: { gte: weekStartDate, lte: weekEnd },
        },
        select: { id: true, title: true, horizon: true, completedAt: true },
      }),

      // XP events this week (sum amount)
      prisma.xpEvent.findMany({
        where: {
          userId,
          createdAt: { gte: weekStartDate, lte: weekEnd },
        },
        select: { amount: true },
      }),

      // Big 3 todos this week
      prisma.todo.findMany({
        where: {
          userId,
          isBig3: true,
          dueDate: { gte: weekStartDate, lte: weekEnd },
        },
        select: { dueDate: true, status: true },
      }),

      // Progress logs this week (for computing per-goal deltas)
      prisma.progressLog.findMany({
        where: {
          goal: { userId },
          createdAt: { gte: weekStartDate, lte: weekEnd },
        },
        include: {
          goal: { select: { id: true, title: true, progress: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Sum XP earned
    const xpEarned = xpEventsRaw.reduce((sum, e) => sum + e.amount, 0);

    // Big 3 stats: count unique dates where at least one Big 3 was set
    const big3DateSet = new Set<string>();
    for (const b of big3Raw) {
      if (b.dueDate) {
        big3DateSet.add(format(b.dueDate, "yyyy-MM-dd"));
      }
    }
    const big3Days = big3DateSet.size;
    const big3Total = big3Raw.length;

    // Compute per-goal progress deltas from progress logs
    const goalLogMap = new Map<
      string,
      { title: string; values: number[] }
    >();
    for (const log of progressLogsRaw) {
      const goalId = log.goal.id;
      const existing = goalLogMap.get(goalId);
      if (existing) {
        existing.values.push(log.value);
      } else {
        goalLogMap.set(goalId, {
          title: log.goal.title,
          values: [log.value],
        });
      }
    }

    const goalProgressDeltas: WeeklyReviewData["goalProgressDeltas"] = [];
    for (const [goalId, data] of goalLogMap.entries()) {
      const progressStart = data.values[0];
      const progressEnd = data.values[data.values.length - 1];
      const delta = progressEnd - progressStart;
      if (delta !== 0) {
        goalProgressDeltas.push({
          id: goalId,
          title: data.title,
          progressStart,
          progressEnd,
          delta,
        });
      }
    }

    const goalsProgressed = goalProgressDeltas.length;

    // Map raw results to response shape
    const completedTodos: WeeklyReviewData["completedTodos"] =
      completedTodosRaw.map((t) => ({
        id: t.id,
        title: t.title,
        completedAt: t.completedAt?.toISOString() ?? null,
        goal: t.goal ? { id: t.goal.id, title: t.goal.title } : null,
      }));

    const carriedOverTodos: WeeklyReviewData["carriedOverTodos"] =
      carriedOverRaw.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate?.toISOString() ?? null,
        priority: t.priority,
        goal: t.goal ? { id: t.goal.id, title: t.goal.title } : null,
      }));

    const completedGoals: WeeklyReviewData["completedGoals"] =
      completedGoalsRaw.map((g) => ({
        id: g.id,
        title: g.title,
        horizon: g.horizon,
        completedAt: g.completedAt?.toISOString() ?? null,
      }));

    return {
      weekStart: format(weekStartDate, "yyyy-MM-dd"),
      weekEnd: format(weekEnd, "yyyy-MM-dd"),
      stats: {
        todosCompleted: completedTodosRaw.length,
        todosCarriedOver: carriedOverRaw.length,
        goalsCompleted: completedGoalsRaw.length,
        goalsProgressed,
        xpEarned,
        big3Days,
        big3Total,
      },
      completedTodos,
      carriedOverTodos,
      goalProgressDeltas,
      completedGoals,
    };
  },

  /**
   * Save a weekly review as a context entry with the "weekly-review" tag.
   * Builds a markdown document from the user's reflections and persists
   * it via the context service so it shows up in the knowledge base.
   */
  async saveReview(userId: string, data: SaveReviewInput) {
    const weekStartDate = startOfDay(new Date(data.weekStart));
    const weekEndDate = addDays(weekStartDate, 6);

    const startFormatted = format(weekStartDate, "MMM d, yyyy");
    const endFormatted = format(weekEndDate, "MMM d, yyyy");
    const nowFormatted = format(new Date(), "MMM d, yyyy 'at' HH:mm");

    const markdownBody = [
      `# Weekly Review: ${startFormatted} to ${endFormatted}`,
      "",
      "## What went well",
      data.wentWell,
      "",
      "## What to improve",
      data.toImprove,
      "",
      "---",
      `*Saved from Ascend weekly review on ${nowFormatted}*`,
    ].join("\n");

    return contextService.create(userId, {
      title: `Weekly Review: ${startFormatted} to ${endFormatted}`,
      content: markdownBody,
      tags: ["weekly-review"],
    });
  },
};
