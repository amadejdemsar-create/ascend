"use client";

import { toast } from "sonner";
import { useDeleteGoal } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface GoalDeleteDialogProps {
  goalId: string;
  goalTitle: string;
  childCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalDeleteDialog({
  goalId,
  goalTitle,
  childCount,
  open,
  onOpenChange,
}: GoalDeleteDialogProps) {
  const deleteGoal = useDeleteGoal();
  const { selectedGoalId, selectGoal } = useUIStore();

  async function handleDelete() {
    try {
      await deleteGoal.mutateAsync(goalId);
      toast.success("Goal deleted");
      if (selectedGoalId === goalId) {
        selectGoal(null);
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete goal";
      toast.error(message);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
          <AlertDialogDescription>
            {childCount > 0
              ? `This goal has ${childCount} sub-goal(s). They will become orphaned (unlinked from parent).`
              : `This will permanently delete "${goalTitle}".`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteGoal.isPending}
          >
            {deleteGoal.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
