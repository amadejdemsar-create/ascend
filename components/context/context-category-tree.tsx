"use client";

import { useCategories } from "@/lib/hooks/use-categories";
import { cn } from "@/lib/utils";

interface CategoryNode {
  id: string;
  name: string;
  color: string;
  children?: CategoryNode[];
}

interface ContextCategoryTreeProps {
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
}

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): Array<CategoryNode & { depth: number }> {
  const result: Array<CategoryNode & { depth: number }> = [];
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children?.length) {
      result.push(...flattenCategories(node.children, depth + 1));
    }
  }
  return result;
}

export function ContextCategoryTree({
  selectedCategoryId,
  onSelectCategory,
}: ContextCategoryTreeProps) {
  const { data: categoryTree } = useCategories();

  const flatCategories = categoryTree
    ? flattenCategories(categoryTree as CategoryNode[])
    : [];

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          selectedCategoryId === null
            ? "bg-muted font-medium"
            : "hover:bg-muted/50",
        )}
      >
        <span className="inline-block size-2.5 rounded-full bg-muted-foreground/40" />
        All
      </button>

      {flatCategories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            selectedCategoryId === cat.id
              ? "bg-muted font-medium"
              : "hover:bg-muted/50",
          )}
          style={{ paddingLeft: `${8 + cat.depth * 12}px` }}
        >
          <span
            className="inline-block size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          {cat.name}
        </button>
      ))}
    </div>
  );
}
