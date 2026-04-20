import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { goalService } from "@/lib/services/goal-service";
import { createTestUser, deleteTestUser } from "./helpers";

/**
 * Goal-side equivalent of the H1/H3 todo tests.
 *
 * goalService.completeWithSideEffects wraps update + XP award +
 * recurring streak bookkeeping in a single $transaction (parity with
 * todoService.complete). Verify the invariants:
 *
 *   1. A successful call awards exactly one XpEvent + stats update.
 *   2. Cross-tenant completion fails with "Goal not found".
 *   3. Recurring instance completion bumps the template streak.
 *   4. weeklyScore is not double-counted on the first completion.
 */
describe("goalService.completeWithSideEffects", () => {
  let user: { id: string; apiKey: string };
  let otherUser: { id: string; apiKey: string };

  beforeAll(async () => {
    user = await createTestUser("goal-complete");
    otherUser = await createTestUser("goal-complete-other");
  });

  afterAll(async () => {
    await deleteTestUser(user.id);
    await deleteTestUser(otherUser.id);
  });

  beforeEach(async () => {
    await prisma.userStats.deleteMany({ where: { userId: user.id } });
    await prisma.xpEvent.deleteMany({ where: { userId: user.id } });
    await prisma.goal.deleteMany({ where: { userId: user.id } });
  });

  it("awards XP and updates stats on a first-time completion", async () => {
    const goal = await goalService.create(user.id, {
      title: "Complete me",
      horizon: "WEEKLY",
      priority: "HIGH",
    });

    const result = await goalService.completeWithSideEffects(user.id, goal.id, {
      status: "COMPLETED",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result._xp.amount).toBeGreaterThan(0);

    const stats = await prisma.userStats.findUnique({
      where: { userId: user.id },
    });
    expect(stats?.totalXp).toBe(result._xp.amount);
    expect(stats?.weeklyScore).toBe(result._xp.amount);

    const events = await prisma.xpEvent.count({ where: { userId: user.id } });
    expect(events).toBe(1);
  });

  it("refuses to complete another user's goal", async () => {
    const goal = await goalService.create(user.id, {
      title: "Mine",
      horizon: "WEEKLY",
    });
    await expect(
      goalService.completeWithSideEffects(otherUser.id, goal.id, {
        status: "COMPLETED",
      }),
    ).rejects.toThrow("Goal not found");
  });

  it("does not double-count weeklyScore on a brand-new user's first completion", async () => {
    const goal = await goalService.create(user.id, {
      title: "First ever",
      horizon: "WEEKLY",
      priority: "MEDIUM",
    });

    const result = await goalService.completeWithSideEffects(user.id, goal.id, {
      status: "COMPLETED",
    });

    const stats = await prisma.userStats.findUnique({
      where: { userId: user.id },
    });
    expect(stats?.weeklyScore).toBe(result._xp.amount);
  });

  it("bumps the recurring template streak when completing an instance", async () => {
    const template = await goalService.create(user.id, {
      title: "Weekly template",
      horizon: "WEEKLY",
      isRecurring: true,
      recurringFrequency: "WEEKLY",
      recurringInterval: 1,
    });
    // Create an instance referencing the template directly so we can
    // exercise the recurringSourceId branch without waiting for a
    // generation pass.
    const instance = await prisma.goal.create({
      data: {
        userId: user.id,
        title: "Instance",
        horizon: "WEEKLY",
        recurringSourceId: template.id,
      },
    });

    const result = await goalService.completeWithSideEffects(
      user.id,
      instance.id,
      { status: "COMPLETED" },
    );

    expect(result).toHaveProperty("_streak");
    const reread = await prisma.goal.findUnique({ where: { id: template.id } });
    expect(reread?.currentStreak).toBe(1);
    expect(reread?.longestStreak).toBe(1);
    expect(reread?.lastCompletedInstance).not.toBeNull();
  });
});
