"use client";

import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";
import { useCategories } from "@/lib/hooks/use-categories";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { CategoryManageDialog } from "./category-manage-dialog";

interface CategoryTreeNode {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  children: CategoryTreeNode[];
}

const MAX_DEPTH = 5;

export function SidebarCategoryTree() {
  const { data: categories, isLoading } = useCategories();
  const { setActiveFilters, activeFilters } = useUIStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editCategory, setEditCategory] = useState<CategoryTreeNode | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  function handleCategoryClick(categoryId: string) {
    if (activeFilters.categoryId === categoryId) {
      const { categoryId: _, ...rest } = activeFilters;
      setActiveFilters(rest);
    } else {
      setActiveFilters({ ...activeFilters, categoryId });
    }
  }

  function handleCreateClick(parentId?: string) {
    setDialogMode("create");
    setEditCategory(null);
    setCreateParentId(parentId ?? null);
    setDialogOpen(true);
  }

  function handleEditClick(category: CategoryTreeNode) {
    setDialogMode("edit");
    setEditCategory(category);
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton disabled>
            <span className="text-xs text-muted-foreground">Loading...</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const treeData = (categories ?? []) as CategoryTreeNode[];

  return (
    <>
      <SidebarMenu>
        {treeData.map((category) => (
          <FlatCategoryNode
            key={category.id}
            category={category}
            depth={0}
            activeCategoryId={activeFilters.categoryId}
            onCategoryClick={handleCategoryClick}
            onEditClick={handleEditClick}
            onAddSubcategory={handleCreateClick}
          />
        ))}

        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => handleCreateClick()} tooltip="Add category" className="text-muted-foreground/60 hover:text-muted-foreground">
            <Plus className="size-3" />
            <span className="text-xs">Add category</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <CategoryManageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        category={editCategory}
        allCategories={treeData}
        defaultParentId={createParentId}
      />
    </>
  );
}

function FlatCategoryNode({
  category,
  depth,
  activeCategoryId,
  onCategoryClick,
  onEditClick,
  onAddSubcategory,
}: {
  category: CategoryTreeNode;
  depth: number;
  activeCategoryId?: string;
  onCategoryClick: (id: string) => void;
  onEditClick: (category: CategoryTreeNode) => void;
  onAddSubcategory: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(category.children.length > 0);

  if (depth >= MAX_DEPTH) return null;

  const isActive = activeCategoryId === category.id;
  const iconName = (category.icon ?? "folder") as IconName;
  const canExpand = depth < MAX_DEPTH - 1;

  return (
    <>
      <SidebarMenuItem>
        <div className="group/catrow relative flex items-center">
          <SidebarMenuButton
            isActive={isActive}
            onClick={() => {
              if (canExpand) setExpanded(!expanded);
              onCategoryClick(category.id);
            }}
            onDoubleClick={() => onEditClick(category)}
            tooltip={category.name}
            className="flex-1"
            // Cap the visible indent at 3 levels so deep trees do not
            // overflow the sidebar horizontally. Depths beyond 3 render at
            // the level-3 indent with an ellipsis prefix to signal the
            // truncated nesting. (L13)
            style={{ paddingLeft: depth > 0 ? `${Math.min(depth, 3) * 12 + 8}px` : undefined }}
          >
            {canExpand && (
              <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
            )}
            {depth > 0 && !canExpand && (
              <span className="text-[10px] text-muted-foreground/40 mr-0.5">&#x2514;</span>
            )}
            {depth > 3 && (
              <span className="text-[10px] text-muted-foreground/60 mr-0.5" aria-label={`Nested ${depth} levels deep`}>
                &#x22EF;
              </span>
            )}
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <DynamicIcon name={iconName} className="size-4 shrink-0" />
            <span className="truncate">{category.name}</span>
          </SidebarMenuButton>
        </div>
      </SidebarMenuItem>

      {expanded && canExpand && (
        <div className="relative">
          {/* Thread line */}
          {category.children.length > 0 && (
            <div
              className="absolute top-0 bottom-2 w-px opacity-15"
              style={{
                backgroundColor: category.color,
                left: `${Math.min(depth, 3) * 12 + 15}px`,
              }}
            />
          )}
          {category.children.map((child) => (
            <FlatCategoryNode
              key={child.id}
              category={child}
              depth={depth + 1}
              activeCategoryId={activeCategoryId}
              onCategoryClick={onCategoryClick}
              onEditClick={onEditClick}
              onAddSubcategory={onAddSubcategory}
            />
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onAddSubcategory(category.id)}
              className="text-muted-foreground/60 hover:text-muted-foreground"
              style={{ paddingLeft: `${Math.min(depth + 1, 3) * 12 + 20}px` }}
            >
              <Plus className="size-3" />
              <span className="text-xs">Add subcategory</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </div>
      )}
    </>
  );
}
