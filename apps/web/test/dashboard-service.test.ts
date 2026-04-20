import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dashboardService } from "@/lib/services/dashboard-service";
import { goalService } from "@/lib/services/goal-service";
import { categoryService } from "@/lib/services/category-service";
import { prisma } from "@/lib/db";
import { addDays } from "date-fns";
import { createTestUser, deleteTestUser } from "./helpers";

describe("dashboardService.getDashboardData", () => {
  let empty: { id: string; apiKey: string };
  let populated: { id: string; apiKey: string };
  let isolated: { id: string; apiKey: string };

  beforeAll(async () => {
    empty = await createTestUser("dash-empty");
    populated = await createTestUser("dash-populated");
    isolated = await createTestUser("dash-isolated");

    // Fixture for `populated`:
    //   - 1 category
    //   - 3 WEEKLY goals (HIGH, MEDIUM, LOW) all IN_PROGRESS
    //     => weeklyFocus should return all 3, sorted HIGH > MEDIUM > LOW
    //   - 2 COMPLETED goals with completedAt = now
    //     => completedThisMonth = 2
    //     => totalCompleted = 2
    //   - 1 QUARTERLY goal IN_PROGRESS with deadline in 7 days
    //     => upcomingDeadlines should surface it
    //   - totalGoals = 6, completionRate = round(2/6*100) = 33

    const category = await categoryService.create(populated.id, {
      name: "Focus",
    });

    const now = new Date();
    const soon = addDays(now, 7);

    await goalService.create(populated.id, {
      title: "Weekly HIGH",
      horizon: "WEEKLY",
      priority: "HIGH",
      categoryId: category.id,
    });
    await goalService.create(populated.id, {
      title: "Weekly MEDIUM",
      horizon: "WEEKLY",
      priority: "MEDIUM",
      categoryId: category.id,
    });
    await goalService.create(populated.id, {
      title: "Weekly LOW",
      horizon: "WEEKLY",
      priority: "LOW",
      categoryId: category.id,
    });

    // Two COMPLETED goals with completedAt set directly so we don't
    // trip transactional side-effects from the service layer.
    const g1 = await goalService.create(populated.id, {
      title: "Completed A",
      horizon: "MONTHLY",
      categoryId: category.id,
    });
    const g2 = await goalService.create(populated.id, {
      title: "Completed B",
      horizon: "MONTHLY",
      categoryId: category.id,
    });
    await prisma.goal.update({
      where: { id: g1.id },
      data: { status: "COMPLETED", completedAt: now },
    });
    await prisma.goal.update({
      where: { id: g2.id },
      data: { status: "COMPLETED", completedAt: now },
    });

    // Upcoming deadline goal (QUARTERLY so it doesn't pollute weeklyFocus)
    await goalService.create(populated.id, {
      title: "Upcoming deadline",
      horizon: "QUARTERLY",
      priority: "HIGH",
      deadline: soon.toISOString(),
    });

    // Seed the isolated user with its own single HIGH weekly goal that
    // should NEVER surface in `populated`'s dashboard.
    await goalService.create(isolated.id, {
      title: "Isolated user's weekly",
      horizon: "WEEKLY",
      priority: "HIGH",
    });
  });

  afterAll(async () => {
    await deleteTestUser(empty.id);
    await deleteTestUser(populated.id);
    await deleteTestUser(isolated.id);
  });

  describe("empty user", () => {
    it("returns safe defaults when the user has no data", async () => {
      const data = await dashboardService.getDashboardData(empty.id);
      expect(data.weeklyFocus).toEqual([]);
      expect(data.progressOverview).toEqual([]);
      expect(data.upcomingDeadlines).toEqual([]);
      expect(data.streaksStats.totalGoals).toBe(0);
      expect(data.streaksStats.totalCompleted).toBe(0);
      expect(data.streaksStats.completedThisMonth).toBe(0);
      expect(data.streaksStats.completionRate).toBe(0);
      expect(data.streaksStats.currentXp).toBe(0);
      expect(data.streaksStats.level).toBe(1);
      expect(data.streaksStats.currentStreak).toBe(0);
      expect(data.streaksStats.weeklyScore).toBe(0);
      expect(data.streaksStats.activeStreaks).toBe(0);
      expect(data.onboardingComplete).toBe(true);
    });
  });

  describe("populated user", () => {
    it("returns the weeklyFocus sorted by priority HIGH > MEDIUM > LOW", async () => {
      const data = await dashboardService.getDashboardData(populated.id);
      expect(data.weeklyFocus).toHaveLength(3);
      expect(data.weeklyFocus[0].title).toBe("Weekly HIGH");
      expect(data.weeklyFocus[1].title).toBe("Weekly MEDIUM");
      expect(data.weeklyFocus[2].title).toBe("Weekly LOW");
    });

    it("counts totals, completions, and completion rate correctly", async () => {
      const data = await dashboardService.getDashboardData(populated.id);
      // 3 weekly + 2 completed monthly + 1 quarterly deadline = 6
      expect(data.streaksStats.totalGoals).toBe(6);
      expect(data.streaksStats.totalCompleted).toBe(2);
      expect(data.streaksStats.completedThisMonth).toBe(2);
      expect(data.streaksStats.completionRate).toBe(33);
    });

    it("surfaces the upcoming deadline goal", async () => {
      const data = await dashboardService.getDashboardData(populated.id);
      expect(data.upcomingDeadlines).toHaveLength(1);
      expect(data.upcomingDeadlines[0].title).toBe("Upcoming deadline");
      expect(data.upcomingDeadlines[0].horizon).toBe("QUARTERLY");
    });

    it("aggregates category progress across goals with that category", async () => {
      const data = await dashboardService.getDashboardData(populated.id);
      // Category "Focus" was assigned to 3 weekly + 2 completed = 5
      // goals. Of those, 2 are COMPLETED.
      const focus = data.progressOverview.find((p) => p.name === "Focus");
      expect(focus).toBeDefined();
      expect(focus!.total).toBe(5);
      expect(focus!.completed).toBe(2);
      expect(focus!.percentage).toBe(40);
    });
  });

  describe("cross-tenant isolation", () => {
    it("does not leak the isolated user's data into the populated user's dashboard", async () => {
      const data = await dashboardService.getDashboardData(populated.id);
      const titles = data.weeklyFocus.map((g) => g.title);
      expect(titles).not.toContain("Isolated user's weekly");
    });

    it("returns only the isolated user's data when called with their id", async () => {
      const data = await dashboardService.getDashboardData(isolated.id);
      expect(data.weeklyFocus).toHaveLength(1);
      expect(data.weeklyFocus[0].title).toBe("Isolated user's weekly");
      expect(data.streaksStats.totalGoals).toBe(1);
    });
  });
});
