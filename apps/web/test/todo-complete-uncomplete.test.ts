import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { goalService } from "@/lib/services/goal-service";
import { todoService } from "@/lib/services/todo-service";
import { XP_PER_TODO } from "@/lib/constants";
import { createTestUser, deleteTestUser } from "./helpers";

/**
 * H1 + H3 + M4 regression tests.
 *
 * The review identified that todoService.complete ran 7+ writes
 * without a transaction, the calendar "toggle uncomplete" path used a
 * plain todo.update that did not reverse XP/progress/streak (causing
 * permanent doubling on every toggle cycle), and the XP logic was
 * duplicated between the todo and goal paths. These tests verify the
 * invariants that the fix must preserve:
 *
 *   1. complete → uncomplete → re-complete must not double XP, level,
 *      weekly score, or goal progress.
 *   2. XpEvent rows must be deleted on uncomplete, not orphaned.
 *   3. UserStats.weeklyScore must start at 0 on first completion
 *      (regression from the pre-existing double-count bug caught by
 *      the smoke test).
 *   4. Cross-tenant uncomplete must fail with "Todo not found".
 */
describe("todoService complete / uncomplete round trip", () => {
  let user: { id: string; apiKey: string };
  let otherUser: { id: string; apiKey: string };

  beforeAll(async () => {
    user = await createTestUser("todo-roundtrip");
    otherUser = await createTestUser("todo-other");
  });

  afterAll(async () => {
    await deleteTestUser(user.id);
    await deleteTestUser(otherUser.id);
  });

  async function readStats(userId: string) {
    return prisma.userStats.findUnique({ where: { userId } });
  }

  async function countXpEvents(userId: string) {
    return prisma.xpEvent.count({ where: { userId } });
  }

  describe("non-doubling XP round trip", () => {
    let goalId: string;
    let todoId: string;
    const priority = "HIGH" as const;
    const expectedXp = XP_PER_TODO[priority];

    beforeEach(async () => {
      // Reset state between tests in this block.
      await prisma.userStats.deleteMany({ where: { userId: user.id } });
      await prisma.xpEvent.deleteMany({ where: { userId: user.id } });
      await prisma.todo.deleteMany({ where: { userId: user.id } });
      await prisma.progressLog.deleteMany({
        where: { goal: { userId: user.id } },
      });
      await prisma.goal.deleteMany({ where: { userId: user.id } });

      const goal = await goalService.create(user.id, {
        title: "Test goal",
        horizon: "WEEKLY",
        targetValue: 10,
      });
      goalId = goal.id;

      const todo = await todoService.create(user.id, {
        title: "Test todo",
        priority,
        goalId,
      });
      todoId = todo.id;
    });

    it("awards exactly expectedXp on first completion", async () => {
      await todoService.complete(user.id, todoId);

      const stats = await readStats(user.id);
      expect(stats?.totalXp).toBe(expectedXp);
      expect(stats?.weeklyScore).toBe(expectedXp);
      expect(await countXpEvents(user.id)).toBe(1);

      const goal = await goalService.getById(user.id, goalId);
      expect(goal?.currentValue).toBe(1);
      expect(goal?.progress).toBe(10);
    });

    it("fully reverses state on uncomplete", async () => {
      await todoService.complete(user.id, todoId);
      await todoService.uncomplete(user.id, todoId);

      const stats = await readStats(user.id);
      expect(stats?.totalXp).toBe(0);
      expect(stats?.weeklyScore).toBe(0);
      expect(await countXpEvents(user.id)).toBe(0);

      const goal = await goalService.getById(user.id, goalId);
      expect(goal?.currentValue).toBe(0);
      expect(goal?.progress).toBe(0);

      const todo = await prisma.todo.findUnique({ where: { id: todoId } });
      expect(todo?.status).toBe("PENDING");
      expect(todo?.completedAt).toBeNull();
    });

    it("lands on the SAME state after complete → uncomplete → re-complete", async () => {
      await todoService.complete(user.id, todoId);
      await todoService.uncomplete(user.id, todoId);
      await todoService.complete(user.id, todoId);

      const stats = await readStats(user.id);
      expect(stats?.totalXp).toBe(expectedXp);
      expect(stats?.weeklyScore).toBe(expectedXp);
      expect(await countXpEvents(user.id)).toBe(1);

      const goal = await goalService.getById(user.id, goalId);
      expect(goal?.currentValue).toBe(1);
      expect(goal?.progress).toBe(10);
    });

    it("never produces negative totals on repeated uncomplete calls", async () => {
      await todoService.complete(user.id, todoId);
      await todoService.uncomplete(user.id, todoId);
      // Second uncomplete on a PENDING todo must throw.
      await expect(todoService.uncomplete(user.id, todoId)).rejects.toThrow(
        "Todo is not in DONE state",
      );

      const stats = await readStats(user.id);
      expect(stats?.totalXp).toBeGreaterThanOrEqual(0);
      expect(stats?.weeklyScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe("cross-tenant guards", () => {
    it("refuses to uncomplete another user's todo", async () => {
      const todo = await todoService.create(user.id, {
        title: "Mine",
        priority: "MEDIUM",
      });
      await todoService.complete(user.id, todo.id);

      await expect(
        todoService.uncomplete(otherUser.id, todo.id),
      ).rejects.toThrow("Todo not found");
    });

    it("refuses to complete another user's todo", async () => {
      const todo = await todoService.create(user.id, {
        title: "Mine",
        priority: "MEDIUM",
      });
      await expect(todoService.complete(otherUser.id, todo.id)).rejects.toThrow(
        "Todo not found",
      );
    });
  });
});
