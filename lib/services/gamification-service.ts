import { prisma } from "@/lib/db";
import {
  XP_PER_HORIZON,
  PRIORITY_MULTIPLIER,
  levelFromXp,
  xpToNextLevel,
} from "@/lib/constants";
import { startOfWeek } from "date-fns";

/**
 * Gamification service: XP awards, level calculation, weekly score tracking.
 *
 * The caller (API route or MCP handler) is responsible for verifying that the
 * goal's status actually transitioned to COMPLETED before calling awardXp.
 * This service focuses purely on XP logic.
 */
export const gamificationService = {
  /**
   * Award XP for completing a goal.
   * Creates an XpEvent record, upserts UserStats, handles level ups
   * and weekly score resets.
   */
  async awardXp(
    userId: string,
    goalId: string,
    horizon: string,
    priority: string,
  ) {
    const baseXp = XP_PER_HORIZON[horizon] ?? 50;
    const multiplier = PRIORITY_MULTIPLIER[priority] ?? 1.0;
    const amount = Math.round(baseXp * multiplier);

    // Create XP event record
    await prisma.xpEvent.create({
      data: {
        userId,
        amount,
        source: `goal_complete:${horizon}:${priority}`,
        goalId,
      },
    });

    // Upsert UserStats: increment totalXp and goalsCompleted
    const stats = await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        totalXp: amount,
        level: levelFromXp(amount) || 1,
        goalsCompleted: 1,
        weeklyScore: amount,
        weekStartDate: startOfWeek(new Date(), { weekStartsOn: 1 }),
      },
      update: {
        totalXp: { increment: amount },
        goalsCompleted: { increment: 1 },
      },
    });

    const now = new Date();

    // Check and reset weekly score if needed (only on update path)
    const weeklyReset = this.checkAndResetWeeklyScore(stats, now);
    let newWeeklyScore: number;

    if (weeklyReset) {
      // Week has rolled over: reset to just this award
      newWeeklyScore = amount;
    } else {
      newWeeklyScore = stats.weeklyScore + amount;
    }

    // Compute new level
    const newLevel = levelFromXp(stats.totalXp) || 1;
    const leveledUp = newLevel > stats.level;

    // Update level, weeklyScore, and weekStartDate
    await prisma.userStats.update({
      where: { userId },
      data: {
        level: newLevel,
        weeklyScore: newWeeklyScore,
        weekStartDate: weeklyReset
          ? startOfWeek(now, { weekStartsOn: 1 })
          : stats.weekStartDate ?? startOfWeek(now, { weekStartsOn: 1 }),
      },
    });

    return {
      amount,
      totalXp: stats.totalXp,
      level: newLevel,
      leveledUp,
      weeklyScore: newWeeklyScore,
    };
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
