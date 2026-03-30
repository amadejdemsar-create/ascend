"use client";

import { toast } from "sonner";
import { useUIStore } from "@/lib/stores/ui-store";
import { useCreateGoal, useUpdateGoal } from "@/lib/hooks/use-goals";
import { GoalForm } from "@/components/goals/goal-form";
import type { CreateGoalInput, UpdateGoalInput } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function GoalModal() {
  const {
    goalModalOpen,
    goalModalMode,
    goalModalHorizon,
    goalEditData,
    closeGoalModal,
  } = useUIStore();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const isSubmitting = createGoal.isPending || updateGoal.isPending;

  const initialData = {
    ...(goalEditData ?? {}),
    ...(goalModalHorizon ? { horizon: goalModalHorizon } : {}),
  } as Partial<CreateGoalInput & { id: string }>;

  const editGoalId = goalEditData?.id;

  async function handleSubmit(data: CreateGoalInput | UpdateGoalInput) {
    try {
      if (goalModalMode === "edit" && editGoalId) {
        await updateGoal.mutateAsync({
          id: editGoalId,
          data: data as UpdateGoalInput,
        });
        toast.success("Goal updated!");
      } else {
        await createGoal.mutateAsync(data as CreateGoalInput);
        toast.success("Goal created!");
      }
      closeGoalModal();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    }
  }

  return (
    <Dialog
      open={goalModalOpen}
      onOpenChange={(open) => {
        if (!open) closeGoalModal();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {goalModalMode === "create" ? "Create Goal" : "Edit Goal"}
          </DialogTitle>
          <DialogDescription>
            {goalModalMode === "create"
              ? "Define a new goal with its details and targets."
              : "Update the goal details below."}
          </DialogDescription>
        </DialogHeader>
        <GoalForm
          mode={goalModalMode}
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={closeGoalModal}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
