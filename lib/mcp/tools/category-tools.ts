import { categoryService } from "@/lib/services/category-service";
import { createCategorySchema, updateCategorySchema } from "@/lib/validations";

type McpContent = { content: Array<{ type: "text"; text: string }> };

interface CategoryTreeNode {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  parentId: string | null;
  children: CategoryTreeNode[];
}

/**
 * Format a category tree node as an indented text line,
 * recursively including children.
 */
function formatCategory(cat: CategoryTreeNode, indent: number): string {
  const prefix = "  ".repeat(indent);
  const iconPart = cat.icon ? ` [${cat.icon}]` : "";
  const line = `${prefix}- ${cat.name} (${cat.color})${iconPart}`;
  if (cat.children.length === 0) return line;
  const childLines = cat.children.map((c) => formatCategory(c, indent + 1));
  return [line, ...childLines].join("\n");
}

/**
 * Handle all category-related MCP tool calls.
 * Validates args with Zod v4, delegates to the service layer,
 * and returns MCP-formatted text content.
 */
export async function handleCategoryTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "create_category": {
        const data = createCategorySchema.parse(args);
        const category = await categoryService.create(userId, data);
        return {
          content: [{ type: "text", text: JSON.stringify(category, null, 2) }],
        };
      }

      case "update_category": {
        const { id, ...rest } = args as { id: string } & Record<string, unknown>;
        if (!id || typeof id !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "id is required and must be a non-empty string" }) }],
          };
        }
        const data = updateCategorySchema.parse(rest);
        const category = await categoryService.update(userId, id, data);
        return {
          content: [{ type: "text", text: JSON.stringify(category, null, 2) }],
        };
      }

      case "delete_category": {
        const { id } = args as { id: string };
        if (!id || typeof id !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "id is required and must be a non-empty string" }) }],
          };
        }
        await categoryService.delete(userId, id);
        return {
          content: [{ type: "text", text: "Category deleted successfully." }],
        };
      }

      case "list_categories": {
        const categories = await categoryService.listTree(userId);
        const tree =
          categories.length === 0
            ? "No categories found."
            : categories.map((c) => formatCategory(c as CategoryTreeNode, 0)).join("\n");
        const text =
          `## Categories\n\n${tree}\n\n---\n\n` +
          JSON.stringify(categories, null, 2);
        return { content: [{ type: "text", text }] };
      }

      default:
        throw new Error(`Unknown category tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    };
  }
}
