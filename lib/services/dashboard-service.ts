import { prisma } from "@/lib/db";
import { addDays, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import { xpToNextLevel } from "@/lib/constants";

// --- Types ---

export interface WeeklyFocusGoal {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  deadline: string | null;
  category: { id: string; name: string; color: string; icon: string | null } | null;
}

export interface CategoryProgress {
  categoryId: string;
  name: string;
  color: string;
  icon: string | null;
  total: number;
  completed: number;
  percentage: number;
}

export interface StatsData {
  completedThisMonth: number;
  totalGoals: number;
  totalCompleted: number;
  completionRate: number;
  currentXp: number;
  level: number;
  currentStreak: number;
  weeklyScore: number;
  longestStreak: number;
  activeStreaks: number;
  xpToNext: { current: number; needed: number; percentage: number };
}

export interface DeadlineGoal {
  id: string;
  title: string;
  status: string;
  priority: string;
  horizon: string;
  deadline: string;
  category: { id: string; name: string; color: string; icon: string | null } | null;
}

export interface DashboardData {
  weeklyFocus: WeeklyFocusGoal[];
  progressOverview: CategoryProgress[];
  streaksStats: StatsData;
  upcomingDeadlines: DeadlineGoal[];
  onboardingComplete: boolean;
}

// Explicit priority ordering to avoid Prisma enum ordinal ambiguity
const PRIORITY_ORDER: Record<string, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };

// --- Service ---

export const dashboardService = {
  /**
   * Aggregate all dashboard widget data in a single call.
   * Runs independent queries in parallel for performance.
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    const now = new Date();

    // Parallel batch 1: four independent queries
    const [weeklyRaw, upcomingRaw, categoryGoals, completedThisMonth] =
      await Promise.all([
        // a) Weekly focus goals
        prisma.goal.findMany({
          where: {
            userId,
            horizon: "WEEKLY",
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
          },
          orderBy: [{ priority: "desc" }, { deadline: "asc" }],
          take: 5,
          include: { category: true },
        }),

        // b) Upcoming deadlines (next 14 days)
        prisma.goal.findMany({
          where: {
            userId,
            deadline: { gte: now, lte: addDays(now, 14) },
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
          },
          orderBy: { deadline: "asc" },
          include: { category: true },
        }),

        // c) All goals with categories for aggregation
        prisma.goal.findMany({
          where: { userId, categoryId: { not: null } },
          select: {
            id: true,
            status: true,
            categoryId: true,
            category: { select: { id: true, name: true, color: true, icon: true } },
          },
        }),

        // d) Goals completed this month
        prisma.goal.count({
          where: {
            userId,
            status: "COMPLETED",
            completedAt: { gte: startOfMonth(now), lte: endOfMonth(now) },
          },
        }),
      ]);

    // Parallel batch 2: totals for completion rate + user stats + active streaks + onboarding
    const [totalGoals, totalCompleted, userStats, activeStreaksCount, userRecord] = await Promise.all([
      prisma.goal.count({ where: { userId } }),
      prisma.goal.count({ where: { userId, status: "COMPLETED" } }),
      prisma.userStats.findUnique({ where: { userId } }),
      prisma.goal.count({
        where: {
          userId,
          isRecurring: true,
          recurringSourceId: null,
          currentStreak: { gt: 0 },
        },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { onboardingComplete: true } }),
    ]);

    // Sort weekly focus in JS to guarantee correct priority ordering
    const weeklyFocus: WeeklyFocusGoal[] = weeklyRaw
      .sort((a, b) => {
        const pDiff = (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
        if (pDiff !== 0) return pDiff;
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.getTime() - b.deadline.getTime();
      })
      .map((g) => ({
        id: g.id,
        title: g.title,
        status: g.status,
        priority: g.priority,
        progress: g.progress,
        deadline: g.deadline?.toISOString() ?? null,
        category: g.category
          ? { id: g.category.id, name: g.category.name, color: g.category.color, icon: g.category.icon }
          : null,
      }));

    // Aggregate category progress
    const categoryMap = new Map<
      string,
      { name: string; color: string; icon: string | null; total: number; completed: number }
    >();
    for (const g of categoryGoals) {
      if (!g.categoryId || !g.category) continue;
      const existing = categoryMap.get(g.categoryId);
      if (existing) {
        existing.total += 1;
        if (g.status === "COMPLETED") existing.completed += 1;
      } else {
        categoryMap.set(g.categoryId, {
          name: g.category.name,
          color: g.category.color,
          icon: g.category.icon,
          total: 1,
          completed: g.status === "COMPLETED" ? 1 : 0,
        });
      }
    }

    const progressOverview: CategoryProgress[] = Array.from(categoryMap.entries()).map(
      ([categoryId, data]) => ({
        categoryId,
        name: data.name,
        color: data.color,
        icon: data.icon,
        total: data.total,
        completed: data.completed,
        percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }),
    );

    // Map upcoming deadlines
    const upcomingDeadlines: DeadlineGoal[] = upcomingRaw.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      priority: g.priority,
      horizon: g.horizon,
      deadline: g.deadline!.toISOString(),
      category: g.category
        ? { id: g.category.id, name: g.category.name, color: g.category.color, icon: g.category.icon }
        : null,
    }));

    // Build stats with safe defaults when UserStats is not yet populated
    const completionRate = totalGoals > 0 ? Math.round((totalCompleted / totalGoals) * 100) : 0;

    // Check and reset weekly score if weekStartDate is stale (before current Monday)
    let weeklyScore = userStats?.weeklyScore ?? 0;
    if (userStats?.weekStartDate) {
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      if (userStats.weekStartDate.getTime() < currentWeekStart.getTime()) {
        weeklyScore = 0;
      }
    }

    const streaksStats: StatsData = {
      completedThisMonth,
      totalGoals,
      totalCompleted,
      completionRate,
      currentXp: userStats?.totalXp ?? 0,
      level: userStats?.level ?? 1,
      currentStreak: userStats?.currentStreak ?? 0,
      weeklyScore,
      longestStreak: userStats?.longestStreak ?? 0,
      activeStreaks: activeStreaksCount,
      xpToNext: xpToNextLevel(userStats?.totalXp ?? 0),
    };

    return {
      weeklyFocus,
      progressOverview,
      streaksStats,
      upcomingDeadlines,
      onboardingComplete: userRecord?.onboardingComplete ?? false,
    };
  },

  /**
   * Compute the progress percentage of a parent goal based on its children's completion.
   * Returns { total, completed, percentage }.
   */
  async getChildrenProgress(userId: string, goalId: string) {
    const children = await prisma.goal.findMany({
      where: { userId, parentId: goalId },
      select: { id: true, status: true },
    });

    const total = children.length;
    const completed = children.filter((c) => c.status === "COMPLETED").length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, percentage };
  },
};
