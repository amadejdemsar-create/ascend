import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { contextService } from "@/lib/services/context-service";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUser } from "./helpers";

describe("contextService", () => {
  // Two users to verify cross-tenant boundaries (C1 analog for context
  // entries, plus C2 regression for the raw SQL backlink cleanup in
  // delete() that used to rewrite linkedEntryIds without a userId
  // filter).
  let userA: { id: string; apiKey: string };
  let userB: { id: string; apiKey: string };

  beforeAll(async () => {
    userA = await createTestUser("ctx-a");
    userB = await createTestUser("ctx-b");
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  describe("update cross-tenant guard", () => {
    it("updates an entry owned by the caller", async () => {
      const entry = await contextService.create(userA.id, {
        title: "A entry",
        content: "hello",
        tags: [],
      });

      const updated = await contextService.update(userA.id, entry.id, {
        content: "hello world",
      });

      expect(updated.content).toBe("hello world");
      expect(updated.userId).toBe(userA.id);
    });

    it("refuses to update an entry owned by a different user", async () => {
      const entry = await contextService.create(userA.id, {
        title: "A entry",
        content: "hello",
        tags: [],
      });

      await expect(
        contextService.update(userB.id, entry.id, { content: "HIJACKED" }),
      ).rejects.toThrow("Context entry not found");

      // And the original content must be unchanged.
      const reread = await contextService.getById(userA.id, entry.id);
      expect(reread?.content).toBe("hello");
    });
  });

  describe("delete cross-tenant guard", () => {
    it("deletes an entry owned by the caller", async () => {
      const entry = await contextService.create(userA.id, {
        title: "A to delete",
        content: "body",
        tags: [],
      });
      await contextService.delete(userA.id, entry.id);
      const reread = await contextService.getById(userA.id, entry.id);
      expect(reread).toBeNull();
    });

    it("refuses to delete an entry owned by a different user", async () => {
      const entry = await contextService.create(userA.id, {
        title: "A protected",
        content: "body",
        tags: [],
      });
      await expect(
        contextService.delete(userB.id, entry.id),
      ).rejects.toThrow("Context entry not found");
      const reread = await contextService.getById(userA.id, entry.id);
      expect(reread).not.toBeNull();
    });
  });

  describe("getById cross-tenant read", () => {
    it("returns null when the requesting user does not own the entry", async () => {
      const entry = await contextService.create(userA.id, {
        title: "A private",
        content: "secret",
        tags: [],
      });
      const fetched = await contextService.getById(userB.id, entry.id);
      expect(fetched).toBeNull();
    });
  });

  describe("backlink resolution via [[Title]] parsing", () => {
    it("populates linkedEntryIds from [[Title]] references on create", async () => {
      const target1 = await contextService.create(userA.id, {
        title: "Strategy",
        content: "A strategy doc.",
        tags: [],
      });
      const target2 = await contextService.create(userA.id, {
        title: "Research",
        content: "A research doc.",
        tags: [],
      });

      const source = await contextService.create(userA.id, {
        title: "Weekly Review",
        content: "See [[Strategy]] and [[Research]] for context.",
        tags: [],
      });

      expect(source.linkedEntryIds.sort()).toEqual(
        [target1.id, target2.id].sort(),
      );
    });

    it("re-parses linkedEntryIds when content changes on update", async () => {
      const t1 = await contextService.create(userA.id, {
        title: "Note One",
        content: "body",
        tags: [],
      });
      const t2 = await contextService.create(userA.id, {
        title: "Note Two",
        content: "body",
        tags: [],
      });
      const source = await contextService.create(userA.id, {
        title: "Source",
        content: "See [[Note One]].",
        tags: [],
      });
      expect(source.linkedEntryIds).toEqual([t1.id]);

      const updated = await contextService.update(userA.id, source.id, {
        content: "Now see [[Note Two]] instead.",
      });
      expect(updated.linkedEntryIds).toEqual([t2.id]);
    });

    it("does not resolve [[Title]] across user boundaries", async () => {
      // A has an entry titled "Shared Name"; B writes a doc that
      // references [[Shared Name]]. The backlink must NOT resolve to
      // A's entry id because parseBacklinks is scoped by userId.
      await contextService.create(userA.id, {
        title: "Shared Name",
        content: "A's secret",
        tags: [],
      });

      const bEntry = await contextService.create(userB.id, {
        title: "B Source",
        content: "Referencing [[Shared Name]] should not leak across users.",
        tags: [],
      });

      expect(bEntry.linkedEntryIds).toEqual([]);
    });
  });

  describe("delete backlink cleanup (C2 regression)", () => {
    it("removes the deleted id from linkedEntryIds on the caller's other entries", async () => {
      const target = await contextService.create(userA.id, {
        title: "To Be Deleted",
        content: "will die",
        tags: [],
      });
      const referrer = await contextService.create(userA.id, {
        title: "Referrer",
        content: "See [[To Be Deleted]].",
        tags: [],
      });
      expect(referrer.linkedEntryIds).toEqual([target.id]);

      await contextService.delete(userA.id, target.id);

      const rereadReferrer = await contextService.getById(userA.id, referrer.id);
      expect(rereadReferrer?.linkedEntryIds).toEqual([]);
    });

    it("does NOT touch another user's linkedEntryIds even on id collisions", async () => {
      // Simulate the worst case: user B has an entry whose
      // linkedEntryIds array contains a string that happens to equal
      // user A's target id. When A deletes their own target, the raw
      // UPDATE must NOT strip that value from B's row.
      const aTarget = await contextService.create(userA.id, {
        title: "A target",
        content: "body",
        tags: [],
      });

      // B creates an entry, then we surgically put aTarget.id into B's
      // linkedEntryIds to simulate a cross-user collision.
      const bEntry = await contextService.create(userB.id, {
        title: "B entry",
        content: "body",
        tags: [],
      });
      await prisma.contextEntry.update({
        where: { id: bEntry.id },
        data: { linkedEntryIds: { set: [aTarget.id, "other"] } },
      });

      await contextService.delete(userA.id, aTarget.id);

      const bReread = await prisma.contextEntry.findUnique({
        where: { id: bEntry.id },
      });
      expect(bReread?.linkedEntryIds.sort()).toEqual([aTarget.id, "other"].sort());
    });
  });
});
