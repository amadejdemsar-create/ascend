"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useDeleteCategory } from "@/lib/hooks/use-categories";
import { useUpdateGoal } from "@/lib/hooks/use-goals";
import { toast } from "sonner";

interface CategoryForDelete {
  id: string;
  name: string;
  _count: { goals: number };
}

interface CategoryDeleteDialogProps {
  category: CategoryForDelete;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

interface CategoryFlat {
  id: string;
  name: string;
  children?: CategoryFlat[];
}

function collectDescendantIds(node: CategoryFlat): string[] {
  const ids: string[] = [node.id];
  if (node.children?.length) {
    for (const child of node.children) {
      ids.push(...collectDescendantIds(child));
    }
  }
  return ids;
}

function flattenExcluding(
  nodes: CategoryFlat[],
  excludeIds: Set<string>
): Array<{ id: string; name: string }> {
  const result: Array<{ id: string; name: string }> = [];
  for (const node of nodes) {
    if (!excludeIds.has(node.id)) {
      result.push({ id: node.id, name: node.name });
    }
    if (node.children?.length) {
      result.push(...flattenExcluding(node.children, excludeIds));
    }
  }
  return result;
}

export function CategoryDeleteDialog({
  category,
  open,
  onOpenChange,
  onConfirm,
}: CategoryDeleteDialogProps) {
  const [reassignMode, setReassignMode] = useState<
    "uncategorize" | "reassign"
  >("uncategorize");
  const [targetCategoryId, setTargetCategoryId] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: categoryTree } = useCategories();
  const deleteCategory = useDeleteCategory();
  const updateGoal = useUpdateGoal();

  const goalCount = category._count.goals;
  const hasGoals = goalCount > 0;

  // Find the category being deleted in the tree and exclude it + descendants
  function findNode(
    nodes: CategoryFlat[],
    id: string
  ): CategoryFlat | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children?.length) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  const tree = (categoryTree ?? []) as CategoryFlat[];
  const targetNode = findNode(tree, category.id);
  const excludeIds = new Set(
    targetNode ? collectDescendantIds(targetNode) : [category.id]
  );
  const availableCategories = flattenExcluding(tree, excludeIds);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      if (hasGoals && reassignMode === "reassign" && targetCategoryId) {
        // Fetch goals in this category and reassign them
        const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;
        const res = await fetch(
          `/api/goals?categoryId=${category.id}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${API_KEY}`,
            },
          }
        );
        if (res.ok) {
          const goals = (await res.json()) as Array<{ id: string }>;
          for (const goal of goals) {
            await updateGoal.mutateAsync({
              id: goal.id,
              data: { categoryId: targetCategoryId },
            });
          }
        }
      }

      await deleteCategory.mutateAsync(category.id);
      toast.success(`Category "${category.name}" deleted`);
      onConfirm();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete category"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <Trash2 className="size-5 text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete &ldquo;{category.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasGoals
              ? `This category has ${goalCount} goal${goalCount !== 1 ? "s" : ""}. Choose what to do with them.`
              : "This category and any subcategories will be permanently deleted."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasGoals && (
          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="delete-mode"
                value="uncategorize"
                checked={reassignMode === "uncategorize"}
                onChange={() => setReassignMode("uncategorize")}
                className="mt-0.5 accent-primary"
              />
              <span className="text-sm">
                Leave {goalCount} goal{goalCount !== 1 ? "s" : ""} uncategorized
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="delete-mode"
                value="reassign"
                checked={reassignMode === "reassign"}
                onChange={() => setReassignMode("reassign")}
                className="mt-0.5 accent-primary"
              />
              <span className="text-sm">
                Reassign {goalCount} goal{goalCount !== 1 ? "s" : ""} to:
              </span>
            </label>

            {reassignMode === "reassign" && (
              <div className="ml-6">
                <Select
                  value={targetCategoryId}
                  onValueChange={(v) => setTargetCategoryId(v ?? "")}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={
              isDeleting ||
              (hasGoals &&
                reassignMode === "reassign" &&
                !targetCategoryId)
            }
          >
            {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
