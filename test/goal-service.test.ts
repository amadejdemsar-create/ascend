import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { goalService } from "@/lib/services/goal-service";
import { createTestUser, deleteTestUser } from "./helpers";

describe("goalService", () => {
  // Two users. Tests verify that user B cannot read or mutate user A's
  // goals via the service layer (safety rule 1 + C1 from the review).
  let userA: { id: string; apiKey: string };
  let userB: { id: string; apiKey: string };

  beforeAll(async () => {
    userA = await createTestUser("goal-a");
    userB = await createTestUser("goal-b");
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  describe("update (C1 cross-tenant guard)", () => {
    it("updates a goal owned by the caller", async () => {
      const goal = await goalService.create(userA.id, {
        title: "A's goal",
        horizon: "WEEKLY",
      });

      const updated = await goalService.update(userA.id, goal.id, {
        title: "A renamed",
      });

      expect(updated.title).toBe("A renamed");
      expect(updated.userId).toBe(userA.id);
    });

    it("refuses to update goals owned by a different user", async () => {
      const goal = await goalService.create(userA.id, {
        title: "A's goal",
        horizon: "WEEKLY",
      });

      // User B tries to rename A's goal via the service. The
      // unconditional findFirst({id, userId}) guard at the top of
      // update() must reject this (C1).
      await expect(
        goalService.update(userB.id, goal.id, { title: "HIJACKED" }),
      ).rejects.toThrow("Goal not found");

      // And the original title must be unchanged.
      const reread = await goalService.getById(userA.id, goal.id);
      expect(reread?.title).toBe("A's goal");
    });

    it("refuses to update a completely non-existent goal", async () => {
      await expect(
        goalService.update(userA.id, "does-not-exist", { title: "ghost" }),
      ).rejects.toThrow("Goal not found");
    });

    it("ignores the cross-tenant guard even for fields that previously skipped it", async () => {
      // Regression test for the original C1 bug: the guard used to
      // only run when parentId or horizon were in the payload. Any
      // other payload (status, priority, description, notes, progress)
      // went straight to prisma.goal.update({where: {id}}) with no
      // userId filter. Verify every non-hierarchy field is guarded.
      const goal = await goalService.create(userA.id, {
        title: "A's goal",
        horizon: "WEEKLY",
      });

      const attacks = [
        { description: "pwned" },
        { priority: "HIGH" as const },
        { progress: 100 },
        { notes: "pwned notes" },
        { status: "IN_PROGRESS" as const },
      ];

      for (const patch of attacks) {
        await expect(goalService.update(userB.id, goal.id, patch)).rejects.toThrow(
          "Goal not found",
        );
      }
    });
  });

  describe("delete (C1 parallel: cross-tenant delete guard)", () => {
    it("deletes a goal owned by the caller", async () => {
      const goal = await goalService.create(userA.id, {
        title: "A's goal",
        horizon: "WEEKLY",
      });
      await goalService.delete(userA.id, goal.id);
      const reread = await goalService.getById(userA.id, goal.id);
      expect(reread).toBeNull();
    });

    it("refuses to delete goals owned by a different user", async () => {
      const goal = await goalService.create(userA.id, {
        title: "A's goal",
        horizon: "WEEKLY",
      });
      await expect(goalService.delete(userB.id, goal.id)).rejects.toThrow(
        "Goal not found",
      );
      const reread = await goalService.getById(userA.id, goal.id);
      expect(reread).not.toBeNull();
    });
  });

  describe("getById (cross-tenant read)", () => {
    it("returns the goal for the owning user", async () => {
      const goal = await goalService.create(userA.id, {
        title: "A's goal",
        horizon: "WEEKLY",
      });
      const fetched = await goalService.getById(userA.id, goal.id);
      expect(fetched?.id).toBe(goal.id);
    });

    it("returns null for a different user's id", async () => {
      const goal = await goalService.create(userA.id, {
        title: "A's goal",
        horizon: "WEEKLY",
      });
      const fetched = await goalService.getById(userB.id, goal.id);
      expect(fetched).toBeNull();
    });
  });
});
