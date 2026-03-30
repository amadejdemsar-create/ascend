"use client";

import { useState } from "react";
import { ChevronRight, Plus, Settings } from "lucide-react";
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

  function handleCategoryClick(categoryId: string) {
    if (activeFilters.categoryId === categoryId) {
      // Toggle off if already selected
      const { categoryId: _, ...rest } = activeFilters;
      setActiveFilters(rest);
    } else {
      setActiveFilters({ ...activeFilters, categoryId });
    }
  }

  function handleCreateClick() {
    setDialogMode("create");
    setEditCategory(null);
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
          />
        ))}

        <SidebarMenuItem>
          <div className="flex items-center gap-1 px-2 py-1">
            <SidebarMenuButton
              onClick={handleCreateClick}
              tooltip="Add category"
              className="flex-1"
            >
              <Plus className="size-4" />
              <span className="text-xs">Add</span>
            </SidebarMenuButton>
            <SidebarMenuButton
              onClick={() => {
                setDialogMode("create");
                setEditCategory(null);
                setDialogOpen(true);
              }}
              tooltip="Manage categories"
            >
              <Settings className="size-4" />
            </SidebarMenuButton>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>

      <CategoryManageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        category={editCategory}
        allCategories={treeData}
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
}: {
  category: CategoryTreeNode;
  depth: number;
  activeCategoryId?: string;
  onCategoryClick: (id: string) => void;
  onEditClick: (category: CategoryTreeNode) => void;
}) {
  if (depth >= MAX_DEPTH) return null;

  const hasChildren = category.children.length > 0;
  const isActive = activeCategoryId === category.id;
  const iconName = (category.icon ?? "folder") as IconName;

  if (hasChildren) {
    return (
      <Collapsible defaultOpen className="group/collapsible">
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
            <ChevronRight className="size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-90" />
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
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onCategoryClick(category.id)}
        onDoubleClick={() => onEditClick(category)}
        tooltip={category.name}
      >
        <span
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <DynamicIcon name={iconName} className="size-4 shrink-0" />
        <span className="truncate">{category.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SubCategoryNode({
  category,
  depth,
  activeCategoryId,
  onCategoryClick,
  onEditClick,
}: {
  category: CategoryTreeNode;
  depth: number;
  activeCategoryId?: string;
  onCategoryClick: (id: string) => void;
  onEditClick: (category: CategoryTreeNode) => void;
}) {
  if (depth >= MAX_DEPTH) return null;

  const hasChildren = category.children.length > 0;
  const isActive = activeCategoryId === category.id;
  const iconName = (category.icon ?? "folder") as IconName;

  if (hasChildren) {
    return (
      <Collapsible defaultOpen className="group/collapsible">
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
            <ChevronRight className="size-3 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-90" />
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
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuSubItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        isActive={isActive}
        onClick={() => onCategoryClick(category.id)}
        onDoubleClick={() => onEditClick(category)}
      >
        <span
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <DynamicIcon name={iconName} className="size-3.5 shrink-0" />
        <span className="truncate">{category.name}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
