"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
          <SidebarMenuButton onClick={() => handleCreateClick()} tooltip="Add category">
            <Plus className="size-4" />
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
  if (depth >= MAX_DEPTH) return null;

  const isActive = activeCategoryId === category.id;
  const iconName = (category.icon ?? "folder") as IconName;
  const hasChildren = category.children.length > 0;

  return (
    <>
      <SidebarMenuItem>
        <div className="group/catrow relative flex items-center">
          <SidebarMenuButton
            isActive={isActive}
            onClick={() => onCategoryClick(category.id)}
            onDoubleClick={() => onEditClick(category)}
            tooltip={category.name}
            className="flex-1"
            style={{ paddingLeft: depth > 0 ? `${depth * 16 + 8}px` : undefined }}
          >
            {depth > 0 && (
              <span className="text-[10px] text-muted-foreground/40 mr-0.5">&#x2514;</span>
            )}
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <DynamicIcon name={iconName} className="size-4 shrink-0" />
            <span className="truncate">{category.name}</span>
          </SidebarMenuButton>
          {depth < MAX_DEPTH - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubcategory(category.id);
              }}
              className="absolute right-1 opacity-0 group-hover/catrow:opacity-100 transition-opacity rounded-md p-1 hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
              aria-label={`Add subcategory to ${category.name}`}
            >
              <Plus className="size-3" />
            </button>
          )}
        </div>
      </SidebarMenuItem>

      {hasChildren && (
        <div
          className="relative"
          style={{ marginLeft: depth > 0 ? `${depth * 16 + 8}px` : undefined }}
        >
          {/* Thread line */}
          <div
            className="absolute left-[19px] top-0 bottom-2 w-px opacity-15"
            style={{ backgroundColor: category.color }}
          />
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
        </div>
      )}
    </>
  );
}
