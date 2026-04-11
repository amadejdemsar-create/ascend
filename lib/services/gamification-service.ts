import { prisma } from "@/lib/db";
import type { Prisma } from "../../generated/prisma/client";
import {
  XP_PER_HORIZON,
  PRIORITY_MULTIPLIER,
  levelFromXp,
  xpToNextLevel,
} from "@/lib/constants";
import { startOfWeek } from "date-fns";

// A Prisma client suitable for either standalone use or inside an
// interactive transaction. Same pattern as goal-service / todo-service.
type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export interface AwardXpResult {
  amount: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  weeklyScore: number;
}

/**
 * Gamification service: XP awards, level calculation, weekly score tracking.
 *
 * The public entry points are `awardXp` (goal path) and `awardXpForTodo`
 * (todo path). Both delegate to the private `awardXpInternal` helper so
 * the XP math, level recomputation, weekly reset, and XpEvent creation
 * all live in ONE place instead of being reinlined in every caller.
 *
 * The caller is responsible for verifying that the goal/todo actually
 * transitioned to COMPLETED before calling.
 */
export const gamificationService = {
  /**
   * Award XP for completing a goal. Computes amount from the goal's
   * horizon and priority, then defers to awardXpInternal.
   *
   * Accepts an optional Prisma client so callers inside an interactive
   * transaction can pass tx.
   */
  async awardXp(
    userId: string,
    goalId: string,
    horizon: string,
    priority: string,
    client: PrismaClientLike = prisma,
  ): Promise<AwardXpResult> {
    const baseXp = XP_PER_HORIZON[horizon] ?? 50;
    const multiplier = PRIORITY_MULTIPLIER[priority] ?? 1.0;
    const amount = Math.round(baseXp * multiplier);

    return awardXpInternal(client, {
      userId,
      amount,
      source: `goal_complete:${horizon}:${priority}`,
      goalId,
    });
  },

  /**
   * Award XP for completing a todo. Used by todoService.complete
   * inside its transaction.
   */
  async awardXpForTodo(
    userId: string,
    todoId: string,
    priority: string,
    amount: number,
    client: PrismaClientLike = prisma,
  ): Promise<AwardXpResult> {
    return awardXpInternal(client, {
      userId,
      amount,
      source: `todo_complete:${priority}`,
      todoId,
    });
  },

  /**
   * Internal helper: checks if the stored weekStartDate is before the current
   * week's Monday. Returns true if a reset is needed.
   */
  checkAndResetWeeklyScore(
    stats: { weekStartDate: Date | null; weeklyScore: number },
    now: Date,
  ): boolean {
    if (!stats.weekStartDate) return true;
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    return stats.weekStartDate.getTime() < currentWeekStart.getTime();
  },
};

/**
 * Shared XP award path used by both awardXp (goals) and awardXpForTodo.
 *
 * Steps:
 *   1. Create an XpEvent row tagged with the originating goalId or todoId
 *   2. Upsert UserStats totalXp (create branch initializes weeklyScore
 *      at 0 so the first-ever completion isn't double-counted)
 *   3. Compute new level + weekly score (with week rollover handling)
 *   4. Update UserStats with new level + weeklyScore + weekStartDate
 *
 * Every read and write uses the provided Prisma client so the whole
 * sequence runs inside the caller's transaction when one is passed.
 */
async function awardXpInternal(
  client: PrismaClientLike,
  params: {
    userId: string;
    amount: number;
    source: string;
    goalId?: string;
    todoId?: string;
  },
): Promise<AwardXpResult> {
  const { userId, amount, source, goalId, todoId } = params;

  await client.xpEvent.create({
    data: {
      userId,
      amount,
      source,
      ...(goalId !== undefined ? { goalId } : {}),
      ...(todoId !== undefined ? { todoId } : {}),
    },
  });

  const stats = await client.userStats.upsert({
    where: { userId },
    create: {
      userId,
      totalXp: amount,
      level: levelFromXp(amount) || 1,
      weeklyScore: 0,
      weekStartDate: startOfWeek(new Date(), { weekStartsOn: 1 }),
    },
    update: {
      totalXp: { increment: amount },
    },
  });

  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const needsWeeklyReset =
    !stats.weekStartDate || stats.weekStartDate.getTime() < currentWeekStart.getTime();

  const newWeeklyScore = needsWeeklyReset ? amount : stats.weeklyScore + amount;
  const newLevel = levelFromXp(stats.totalXp) || 1;
  const leveledUp = newLevel > stats.level;

  await client.userStats.update({
    where: { userId },
    data: {
      level: newLevel,
      weeklyScore: newWeeklyScore,
      weekStartDate: needsWeeklyReset ? currentWeekStart : stats.weekStartDate ?? currentWeekStart,
    },
  });

  return {
    amount,
    totalXp: stats.totalXp,
    level: newLevel,
    leveledUp,
    weeklyScore: newWeeklyScore,
  };
}
