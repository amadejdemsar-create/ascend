import { prisma } from "@/lib/db";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/validations";
import { permissionService } from "@/lib/services/permission-service";

// Type for nested category tree nodes
interface CategoryTreeNode {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  color: string;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  children: CategoryTreeNode[];
}

export const categoryService = {
  /**
   * List all categories for a user, ordered by sortOrder.
   * Includes direct children.
   */
  async list(userId: string, workspaceId: string) {
    return prisma.category.findMany({
      where: { userId, workspaceId },
      orderBy: { sortOrder: "asc" },
      include: { children: true },
    });
  },

  /**
   * Get all categories as a nested tree structure.
   * Top-level categories (parentId null) contain their children recursively.
   */
  async listTree(userId: string, workspaceId: string): Promise<CategoryTreeNode[]> {
    const allCategories = await prisma.category.findMany({
      where: { userId, workspaceId },
      orderBy: { sortOrder: "asc" },
    });

    const categoryMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    // First pass: create tree nodes for all categories
    for (const cat of allCategories) {
      categoryMap.set(cat.id, { ...cat, children: [] });
    }

    // Second pass: build the tree by linking children to parents
    for (const cat of allCategories) {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  },

  /**
   * Create a new category for a user.
   */
  async create(userId: string, workspaceId: string, data: CreateCategoryInput) {
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    return prisma.category.create({
      data: { ...data, userId, workspaceId },
    });
  },

  /**
   * Get a single category by ID with a count of associated goals.
   * Returns null if not found or not owned by the user.
   */
  async getById(userId: string, workspaceId: string, id: string) {
    return prisma.category.findFirst({
      where: { id, userId, workspaceId },
      include: {
        _count: { select: { goals: true } },
      },
    });
  },

  /**
   * Update a category. Verifies ownership before updating.
   */
  async update(userId: string, workspaceId: string, id: string, data: UpdateCategoryInput) {
    await permissionService.assertCanPerform(userId, workspaceId, "WRITE_NODE");

    const category = await prisma.category.findFirst({ where: { id, userId, workspaceId } });
    if (!category) throw new Error("Category not found");

    return prisma.category.update({
      where: { id },
      data,
    });
  },

  /**
   * Delete a category. Children cascade (onDelete: Cascade),
   * goals get categoryId set to null (onDelete: SetNull).
   */
  async delete(userId: string, workspaceId: string, id: string) {
    await permissionService.assertCanPerform(userId, workspaceId, "DELETE_NODE");

    const category = await prisma.category.findFirst({ where: { id, userId, workspaceId } });
    if (!category) throw new Error("Category not found");

    return prisma.category.delete({ where: { id } });
  },
};
