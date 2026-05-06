import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { contextService } from "@/lib/services/context-service";
import { createTestUser, deleteTestUser } from "./helpers";

describe("contextService", () => {
  // Two users to verify cross-tenant boundaries (C1 analog for context
  // entries, plus C2 regression for cascade-delete of ContextLinks).
  let userA: { id: string; apiKey: string; workspaceId: string };
  let userB: { id: string; apiKey: string; workspaceId: string };

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
      const entry = await contextService.create(userA.id, userA.workspaceId, {
        title: "A entry",
        content: "hello",
        tags: [],
      });

      const updated = await contextService.update(userA.id, userA.workspaceId, entry.id, {
        content: "hello world",
      });

      expect(updated.content).toBe("hello world");
      expect(updated.userId).toBe(userA.id);
    });

    it("refuses to update an entry owned by a different user", async () => {
      const entry = await contextService.create(userA.id, userA.workspaceId, {
        title: "A entry",
        content: "hello",
        tags: [],
      });

      await expect(
        contextService.update(userB.id, userB.workspaceId, entry.id, { content: "HIJACKED" }),
      ).rejects.toThrow("Context entry not found");

      // And the original content must be unchanged.
      const reread = await contextService.getById(userA.id, userA.workspaceId, entry.id);
      expect(reread?.content).toBe("hello");
    });
  });

  describe("delete cross-tenant guard", () => {
    it("deletes an entry owned by the caller", async () => {
      const entry = await contextService.create(userA.id, userA.workspaceId, {
        title: "A to delete",
        content: "body",
        tags: [],
      });
      await contextService.delete(userA.id, userA.workspaceId, entry.id);
      const reread = await contextService.getById(userA.id, userA.workspaceId, entry.id);
      expect(reread).toBeNull();
    });

    it("refuses to delete an entry owned by a different user", async () => {
      const entry = await contextService.create(userA.id, userA.workspaceId, {
        title: "A protected",
        content: "body",
        tags: [],
      });
      await expect(
        contextService.delete(userB.id, userB.workspaceId, entry.id),
      ).rejects.toThrow("Context entry not found");
      const reread = await contextService.getById(userA.id, userA.workspaceId, entry.id);
      expect(reread).not.toBeNull();
    });
  });

  describe("getById cross-tenant read", () => {
    it("returns null when the requesting user does not own the entry", async () => {
      const entry = await contextService.create(userA.id, userA.workspaceId, {
        title: "A private",
        content: "secret",
        tags: [],
      });
      const fetched = await contextService.getById(userB.id, userB.workspaceId, entry.id);
      expect(fetched).toBeNull();
    });
  });

  describe("wikilink resolution via ContextLink (typed edges)", () => {
    it("creates ContextLink rows from [[Title]] references on create", async () => {
      const target1 = await contextService.create(userA.id, userA.workspaceId, {
        title: "Strategy",
        content: "A strategy doc.",
        tags: [],
      });
      const target2 = await contextService.create(userA.id, userA.workspaceId, {
        title: "Research",
        content: "A research doc.",
        tags: [],
      });

      const source = await contextService.create(userA.id, userA.workspaceId, {
        title: "Weekly Review",
        content: "See [[Strategy]] and [[Research]] for context.",
        tags: [],
      });

      // Verify via getById which joins outgoingLinks
      const full = await contextService.getById(userA.id, userA.workspaceId, source.id);
      const linkedIds = (full?.outgoingLinks ?? []).map((l) => l.toEntry.id).sort();
      expect(linkedIds).toEqual([target1.id, target2.id].sort());
    });

    it("re-syncs ContextLinks when content changes on update", async () => {
      const t1 = await contextService.create(userA.id, userA.workspaceId, {
        title: "Note One",
        content: "body",
        tags: [],
      });
      const t2 = await contextService.create(userA.id, userA.workspaceId, {
        title: "Note Two",
        content: "body",
        tags: [],
      });
      const source = await contextService.create(userA.id, userA.workspaceId, {
        title: "Source",
        content: "See [[Note One]].",
        tags: [],
      });

      const fullBefore = await contextService.getById(userA.id, userA.workspaceId, source.id);
      expect((fullBefore?.outgoingLinks ?? []).map((l) => l.toEntry.id)).toEqual([t1.id]);

      await contextService.update(userA.id, userA.workspaceId, source.id, {
        content: "Now see [[Note Two]] instead.",
      });

      const fullAfter = await contextService.getById(userA.id, userA.workspaceId, source.id);
      expect((fullAfter?.outgoingLinks ?? []).map((l) => l.toEntry.id)).toEqual([t2.id]);
    });

    it("does not resolve [[Title]] across user boundaries", async () => {
      // A has an entry titled "Shared Name"; B writes a doc that
      // references [[Shared Name]]. The link must NOT resolve to
      // A's entry id because syncContentLinks is scoped by userId.
      await contextService.create(userA.id, userA.workspaceId, {
        title: "Shared Name",
        content: "A's secret",
        tags: [],
      });

      const bEntry = await contextService.create(userB.id, userB.workspaceId, {
        title: "B Source",
        content: "Referencing [[Shared Name]] should not leak across users.",
        tags: [],
      });

      const fullB = await contextService.getById(userB.id, userB.workspaceId, bEntry.id);
      expect(fullB?.outgoingLinks ?? []).toEqual([]);
    });
  });

  describe("delete cascade cleanup", () => {
    it("cascade-deletes ContextLinks when an entry is deleted", async () => {
      const target = await contextService.create(userA.id, userA.workspaceId, {
        title: "To Be Deleted",
        content: "will die",
        tags: [],
      });
      const referrer = await contextService.create(userA.id, userA.workspaceId, {
        title: "Referrer",
        content: "See [[To Be Deleted]].",
        tags: [],
      });

      // Confirm the link exists before delete
      const fullBefore = await contextService.getById(userA.id, userA.workspaceId, referrer.id);
      expect((fullBefore?.outgoingLinks ?? []).length).toBe(1);

      await contextService.delete(userA.id, userA.workspaceId, target.id);

      // After deleting the target, the referrer's outgoing link should be gone
      // because ContextLink has onDelete: Cascade on the toEntry relation.
      const fullAfter = await contextService.getById(userA.id, userA.workspaceId, referrer.id);
      expect(fullAfter?.outgoingLinks ?? []).toEqual([]);
    });

    it("does NOT cascade-delete another user's ContextLinks", async () => {
      const aTarget = await contextService.create(userA.id, userA.workspaceId, {
        title: "A target for cascade",
        content: "body",
        tags: [],
      });

      // B creates entries with their own internal links
      const bTarget = await contextService.create(userB.id, userB.workspaceId, {
        title: "B target",
        content: "body",
        tags: [],
      });
      const bSource = await contextService.create(userB.id, userB.workspaceId, {
        title: "B source",
        content: "See [[B target]].",
        tags: [],
      });

      // Verify B's link exists
      const fullBBefore = await contextService.getById(userB.id, userB.workspaceId, bSource.id);
      expect((fullBBefore?.outgoingLinks ?? []).length).toBe(1);

      // Delete A's entry; B's links must be untouched
      await contextService.delete(userA.id, userA.workspaceId, aTarget.id);

      const fullBAfter = await contextService.getById(userB.id, userB.workspaceId, bSource.id);
      expect((fullBAfter?.outgoingLinks ?? []).length).toBe(1);
    });
  });
});
