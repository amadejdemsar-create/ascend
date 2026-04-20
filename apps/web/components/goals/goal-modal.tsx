"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/stores/ui-store";
import { useCreateGoal, useUpdateGoal } from "@/lib/hooks/use-goals";
import { GoalForm } from "@/components/goals/goal-form";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { GOAL_TEMPLATES } from "@/lib/templates/goal-templates";
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

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [appliedTemplate, setAppliedTemplate] =
    useState<Partial<CreateGoalInput> | null>(null);

  const isSubmitting = createGoal.isPending || updateGoal.isPending;

  const initialData = {
    ...(goalEditData ?? {}),
    ...(goalModalHorizon ? { horizon: goalModalHorizon } : {}),
    ...(appliedTemplate ?? {}),
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
      setAppliedTemplate(null);
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
        if (!open) {
          closeGoalModal();
          setAppliedTemplate(null);
        }
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
        {goalModalMode === "create" && (
          <button
            type="button"
            onClick={() => setTemplatePickerOpen(true)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline mb-2"
          >
            <Sparkles className="size-3.5" />
            Use a template
          </button>
        )}
        <GoalForm
          key={appliedTemplate?.title ?? "blank"}
          mode={goalModalMode}
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={closeGoalModal}
          isSubmitting={isSubmitting}
        />
        <TemplatePickerDialog
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          templates={GOAL_TEMPLATES}
          title="Pick a goal template"
          description="Start from a pre-filled example and customize the fields."
          onPick={(template) => {
            setAppliedTemplate({
              title: template.data.title,
              description: template.data.description,
              horizon: template.horizon,
              priority: template.priority,
              specific: template.data.specific,
              measurable: template.data.measurable,
              attainable: template.data.attainable,
              relevant: template.data.relevant,
              timely: template.data.timely,
              targetValue: template.data.targetValue,
              unit: template.data.unit,
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
