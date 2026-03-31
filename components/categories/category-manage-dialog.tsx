"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import {
  useCreateCategory,
  useUpdateCategory,
} from "@/lib/hooks/use-categories";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoryForm } from "./category-form";
import { CategoryDeleteDialog } from "./category-delete-dialog";
import type { CreateCategoryInput } from "@/lib/validations";

interface CategoryTreeNode {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  children: CategoryTreeNode[];
}

interface CategoryManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  category: CategoryTreeNode | null;
  allCategories: CategoryTreeNode[];
}

function flattenCategories(
  nodes: CategoryTreeNode[]
): Array<{ id: string; name: string; color: string; icon: string | null; parentId: string | null }> {
  const result: Array<{ id: string; name: string; color: string; icon: string | null; parentId: string | null }> = [];
  function walk(list: CategoryTreeNode[]) {
    for (const node of list) {
      result.push({
        id: node.id,
        name: node.name,
        color: node.color,
        icon: node.icon,
        parentId: node.parentId,
      });
      if (node.children.length > 0) walk(node.children);
    }
  }
  walk(nodes);
  return result;
}

export function CategoryManageDialog({
  open,
  onOpenChange,
  mode,
  category,
  allCategories,
}: CategoryManageDialogProps) {
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const flatList = flattenCategories(allCategories);

  function handleSubmit(data: CreateCategoryInput) {
    if (mode === "create") {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success("Category created");
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      });
    } else if (mode === "edit" && category) {
      updateMutation.mutate(
        { id: category.id, data },
        {
          onSuccess: () => {
            toast.success("Category updated");
            onOpenChange(false);
          },
          onError: (error) => {
            toast.error(error.message);
          },
        }
      );
    }
  }

  function handleMoveUp() {
    if (!category) return;
    updateMutation.mutate(
      { id: category.id, data: { sortOrder: category.sortOrder - 1 } },
      {
        onSuccess: () => {
          toast.success("Category moved up");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function handleMoveDown() {
    if (!category) return;
    updateMutation.mutate(
      { id: category.id, data: { sortOrder: category.sortOrder + 1 } },
      {
        onSuccess: () => {
          toast.success("Category moved down");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  function handleDeleteClick() {
    if (!category) return;
    setDeleteDialogOpen(true);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New Category" : "Edit Category"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new category to organize your goals."
              : "Update this category's name, color, icon, or position."}
          </DialogDescription>
        </DialogHeader>

        {mode === "edit" && category && (
          <div className="flex items-center gap-2 border-b pb-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMoveUp}
              disabled={updateMutation.isPending}
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">Move up</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMoveDown}
              disabled={updateMutation.isPending}
            >
              <ArrowDown className="size-4" />
              <span className="sr-only">Move down</span>
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteClick}
            >
              <Trash2 className="size-4" />
              <span className="ml-1">Delete</span>
            </Button>
          </div>
        )}

        <CategoryForm
          key={category?.id ?? "create"}
          initialData={
            mode === "edit" && category
              ? {
                  id: category.id,
                  name: category.name,
                  color: category.color,
                  icon: category.icon,
                  parentId: category.parentId,
                }
              : undefined
          }
          categories={flatList}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>

    {mode === "edit" && category && (
      <CategoryDeleteDialog
        category={{ id: category.id, name: category.name, _count: { goals: 0 } }}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => onOpenChange(false)}
      />
    )}
    </>
  );
}
