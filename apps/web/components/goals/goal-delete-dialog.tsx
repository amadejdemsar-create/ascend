"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDeleteGoal } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [confirmText, setConfirmText] = useState("");

  const needsConfirmation = childCount > 0;
  const confirmMatches = confirmText.trim() === goalTitle.trim();

  async function handleDelete() {
    try {
      await deleteGoal.mutateAsync(goalId);
      toast.success("Goal deleted");
      if (selectedGoalId === goalId) {
        selectGoal(null);
      }
      onOpenChange(false);
      setConfirmText("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete goal";
      toast.error(message);
    }
  }

  function handleOpenChange(o: boolean) {
    if (!o) setConfirmText("");
    onOpenChange(o);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
          <AlertDialogDescription>
            {needsConfirmation
              ? `This goal has ${childCount} sub-goal(s). They will become orphaned (unlinked from parent). Type the goal title to confirm.`
              : `This will permanently delete "${goalTitle}".`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {needsConfirmation && (
          <div className="space-y-2 py-2">
            <Label className="text-xs text-muted-foreground">
              Type &ldquo;{goalTitle}&rdquo; to confirm
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={goalTitle}
              autoFocus
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteGoal.isPending || (needsConfirmation && !confirmMatches)}
          >
            {deleteGoal.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
