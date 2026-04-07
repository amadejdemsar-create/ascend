"use client";

import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";
import { useCategories } from "@/lib/hooks/use-categories";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
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
      // Toggle off if already selected
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
          <CategoryNode
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

function CategoryNode({
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

  return (
    <Collapsible className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              isActive={isActive}
              onClick={() => onCategoryClick(category.id)}
              onDoubleClick={() => onEditClick(category)}
              tooltip={category.name}
            />
          }
        >
          <ChevronRight className="size-4 shrink-0 transition-transform duration-200 group-data-[open]/collapsible:rotate-90" />
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <DynamicIcon name={iconName} className="size-4 shrink-0" />
          <span className="truncate">{category.name}</span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {category.children.map((child) => (
              <SubCategoryNode
                key={child.id}
                category={child}
                depth={depth + 1}
                activeCategoryId={activeCategoryId}
                onCategoryClick={onCategoryClick}
                onEditClick={onEditClick}
                onAddSubcategory={onAddSubcategory}
              />
            ))}
            {depth < MAX_DEPTH - 1 && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  onClick={() => onAddSubcategory(category.id)}
                >
                  <Plus className="size-3 shrink-0" />
                  <span className="truncate text-xs text-muted-foreground">Add subcategory</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function SubCategoryNode({
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

  return (
    <Collapsible className="group/collapsible">
      <SidebarMenuSubItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuSubButton
              isActive={isActive}
              onClick={() => onCategoryClick(category.id)}
              onDoubleClick={() => onEditClick(category)}
            />
          }
        >
          <ChevronRight className="size-3 shrink-0 transition-transform duration-200 group-data-[open]/collapsible:rotate-90" />
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <DynamicIcon name={iconName} className="size-3.5 shrink-0" />
          <span className="truncate">{category.name}</span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {category.children.map((child) => (
              <SubCategoryNode
                key={child.id}
                category={child}
                depth={depth + 1}
                activeCategoryId={activeCategoryId}
                onCategoryClick={onCategoryClick}
                onEditClick={onEditClick}
                onAddSubcategory={onAddSubcategory}
              />
            ))}
            {depth < MAX_DEPTH - 1 && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  onClick={() => onAddSubcategory(category.id)}
                >
                  <Plus className="size-3 shrink-0" />
                  <span className="truncate text-xs text-muted-foreground">Add subcategory</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}
