import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { categoryService } from "@/lib/services/category-service";
import { goalService } from "@/lib/services/goal-service";
import { todoService } from "@/lib/services/todo-service";
import { contextService } from "@/lib/services/context-service";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUser } from "./helpers";

describe("categoryService", () => {
  let userA: { id: string; apiKey: string; workspaceId: string };
  let userB: { id: string; apiKey: string; workspaceId: string };

  beforeAll(async () => {
    userA = await createTestUser("cat-a");
    userB = await createTestUser("cat-b");
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  describe("update cross-tenant guard", () => {
    it("updates a category owned by the caller", async () => {
      const cat = await categoryService.create(userA.id, userA.workspaceId, { name: "Work" });
      const updated = await categoryService.update(userA.id, userA.workspaceId, cat.id, {
        name: "Work Stuff",
      });
      expect(updated.name).toBe("Work Stuff");
      expect(updated.userId).toBe(userA.id);
    });

    it("refuses to update a category owned by a different user", async () => {
      const cat = await categoryService.create(userA.id, userA.workspaceId, { name: "Private" });
      await expect(
        categoryService.update(userB.id, userB.workspaceId, cat.id, { name: "HIJACKED" }),
      ).rejects.toThrow("Category not found");
      const reread = await categoryService.getById(userA.id, userA.workspaceId, cat.id);
      expect(reread?.name).toBe("Private");
    });
  });

  describe("delete cross-tenant guard", () => {
    it("refuses to delete a category owned by a different user", async () => {
      const cat = await categoryService.create(userA.id, userA.workspaceId, { name: "Protected" });
      await expect(
        categoryService.delete(userB.id, userB.workspaceId, cat.id),
      ).rejects.toThrow("Category not found");
      const reread = await categoryService.getById(userA.id, userA.workspaceId, cat.id);
      expect(reread).not.toBeNull();
    });
  });

  describe("listTree", () => {
    it("builds a nested tree for multi-level parent/child categories", async () => {
      // Fresh user so the tree assertion is deterministic (no bleed from
      // other tests in this file).
      const u = await createTestUser("cat-tree");
      try {
        const root = await categoryService.create(u.id, u.workspaceId, { name: "Root" });
        const mid = await categoryService.create(u.id, u.workspaceId, {
          name: "Mid",
          parentId: root.id,
        });
        const leaf = await categoryService.create(u.id, u.workspaceId, {
          name: "Leaf",
          parentId: mid.id,
        });
        const otherRoot = await categoryService.create(u.id, u.workspaceId, {
          name: "OtherRoot",
        });

        const tree = await categoryService.listTree(u.id, u.workspaceId);

        expect(tree).toHaveLength(2);
        const byName = new Map(tree.map((n) => [n.name, n]));
        expect(byName.get("Root")?.children).toHaveLength(1);
        expect(byName.get("Root")?.children[0].name).toBe("Mid");
        expect(byName.get("Root")?.children[0].children).toHaveLength(1);
        expect(byName.get("Root")?.children[0].children[0].name).toBe("Leaf");
        expect(byName.get("Root")?.children[0].children[0].id).toBe(leaf.id);
        expect(byName.get("OtherRoot")?.children).toHaveLength(0);
        expect(byName.get("OtherRoot")?.id).toBe(otherRoot.id);
      } finally {
        await deleteTestUser(u.id);
      }
    });
  });

  describe("delete SetNull cascade", () => {
    it("leaves goals intact but nulls their categoryId", async () => {
      const cat = await categoryService.create(userA.id, userA.workspaceId, { name: "GoalsCat" });
      const goal = await goalService.create(userA.id, userA.workspaceId, {
        title: "G1",
        horizon: "WEEKLY",
        categoryId: cat.id,
      });
      expect(goal.categoryId).toBe(cat.id);

      await categoryService.delete(userA.id, userA.workspaceId, cat.id);

      const reread = await goalService.getById(userA.id, userA.workspaceId, goal.id);
      expect(reread).not.toBeNull();
      expect(reread?.categoryId).toBeNull();
    });

    it("leaves todos intact but nulls their categoryId", async () => {
      const cat = await categoryService.create(userA.id, userA.workspaceId, { name: "TodosCat" });
      const todo = await todoService.create(userA.id, userA.workspaceId, {
        title: "T1",
        categoryId: cat.id,
      });
      expect(todo.categoryId).toBe(cat.id);

      await categoryService.delete(userA.id, userA.workspaceId, cat.id);

      const reread = await prisma.todo.findUnique({ where: { id: todo.id } });
      expect(reread).not.toBeNull();
      expect(reread?.categoryId).toBeNull();
    });

    it("leaves context entries intact but nulls their categoryId", async () => {
      const cat = await categoryService.create(userA.id, userA.workspaceId, {
        name: "ContextCat",
      });
      const entry = await contextService.create(userA.id, userA.workspaceId, {
        title: "E1",
        content: "body",
        categoryId: cat.id,
        tags: [],
      });
      expect(entry.categoryId).toBe(cat.id);

      await categoryService.delete(userA.id, userA.workspaceId, cat.id);

      const reread = await contextService.getById(userA.id, userA.workspaceId, entry.id);
      expect(reread).not.toBeNull();
      expect(reread?.categoryId).toBeNull();
    });

    it("cascades deletion to child categories via onDelete: Cascade", async () => {
      const parent = await categoryService.create(userA.id, userA.workspaceId, {
        name: "ParentCat",
      });
      const child = await categoryService.create(userA.id, userA.workspaceId, {
        name: "ChildCat",
        parentId: parent.id,
      });

      await categoryService.delete(userA.id, userA.workspaceId, parent.id);

      const rereadChild = await categoryService.getById(userA.id, userA.workspaceId, child.id);
      expect(rereadChild).toBeNull();
    });
  });
});
