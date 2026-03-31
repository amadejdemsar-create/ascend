"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useGoal, useUpdateGoal } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import { GoalStatusSelect } from "@/components/goals/goal-status-select";
import { GoalDeleteDialog } from "@/components/goals/goal-delete-dialog";
import { ChildrenList } from "@/components/goals/children-list";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  XIcon,
  PencilIcon,
  Trash2Icon,
  TargetIcon,
  ArrowLeftIcon,
  RepeatIcon,
  FlameIcon,
} from "lucide-react";
import { ProgressIncrement } from "@/components/goals/progress-increment";
import { ProgressHistorySheet } from "@/components/goals/progress-history-sheet";

const HORIZON_LABELS: Record<string, string> = {
  YEARLY: "Yearly",
  QUARTERLY: "Quarterly",
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
};

const SMART_HORIZONS = new Set(["YEARLY", "QUARTERLY"]);

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

const SMART_FIELDS = [
  { key: "specific", label: "Specific", placeholder: "What exactly will you accomplish?" },
  { key: "measurable", label: "Measurable", placeholder: "How will you measure success?" },
  { key: "attainable", label: "Attainable", placeholder: "Is this goal realistic and achievable?" },
  { key: "relevant", label: "Relevant", placeholder: "Why does this goal matter?" },
  { key: "timely", label: "Timely", placeholder: "What is the timeline and key milestones?" },
] as const;

interface GoalDetailProps {
  goalId: string;
  onClose: () => void;
  isMobileOverlay?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoalData = Record<string, any>;

export function GoalDetail({ goalId, onClose, isMobileOverlay }: GoalDetailProps) {
  const { data: goal, isLoading } = useGoal(goalId) as { data: GoalData | undefined; isLoading: boolean };
  const updateGoal = useUpdateGoal();
  const { openGoalModal, setGoalEditData, selectGoal } = useUIStore();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showTargetInputs, setShowTargetInputs] = useState(false);
  const [targetValueInput, setTargetValueInput] = useState("");
  const [unitInput, setUnitInput] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Goal not found.
      </div>
    );
  }

  function startEditing(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue || "");
  }

  async function saveField(field: string) {
    setEditingField(null);
    const trimmed = editValue.trim();
    if (trimmed === (goal?.[field] ?? "")) return;

    try {
      await updateGoal.mutateAsync({
        id: goalId,
        data: { [field]: trimmed || null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast.error(message);
    }
  }

  async function handlePriorityChange(val: string | null) {
    if (!val || val === goal?.priority) return;
    try {
      await updateGoal.mutateAsync({
        id: goalId,
        data: { priority: val as "LOW" | "MEDIUM" | "HIGH" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update priority";
      toast.error(message);
    }
  }

  async function handleDeadlineChange(val: string) {
    try {
      await updateGoal.mutateAsync({
        id: goalId,
        data: { deadline: val ? new Date(val).toISOString() : undefined },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update deadline";
      toast.error(message);
    }
  }

  async function saveTarget() {
    const tv = Number(targetValueInput);
    if (!tv || tv <= 0) {
      toast.error("Target value must be a positive number");
      return;
    }
    try {
      await updateGoal.mutateAsync({
        id: goalId,
        data: {
          targetValue: tv,
          unit: unitInput.trim() || undefined,
        },
      });
      setShowTargetInputs(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to set target";
      toast.error(message);
    }
  }

  function handleEditAll() {
    setGoalEditData({
      id: goal!.id,
      title: goal!.title,
      description: goal!.description,
      horizon: goal!.horizon,
      priority: goal!.priority,
      parentId: goal!.parentId,
      deadline: goal!.deadline,
      specific: goal!.specific,
      measurable: goal!.measurable,
      attainable: goal!.attainable,
      relevant: goal!.relevant,
      timely: goal!.timely,
      targetValue: goal!.targetValue,
      unit: goal!.unit,
      notes: goal!.notes,
    });
    openGoalModal("edit");
  }

  const children = (goal.children ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    horizon: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    progress: number;
  }>;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-2 border-b p-4">
        {isMobileOverlay && (
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <ArrowLeftIcon className="size-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          {editingField === "title" ? (
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveField("title")}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveField("title");
                if (e.key === "Escape") setEditingField(null);
              }}
              className="text-lg font-serif font-semibold"
            />
          ) : (
            <button
              type="button"
              onClick={() => startEditing("title", goal.title)}
              className="text-left text-lg font-serif font-semibold hover:text-primary transition-colors leading-tight"
            >
              {goal.title}
            </button>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="ghost" className="text-[0.65rem] px-1.5 py-0">
              {HORIZON_LABELS[goal.horizon] ?? goal.horizon}
            </Badge>
            {goal.isRecurring && !goal.recurringSourceId && (
              <Badge variant="ghost" className="text-[0.65rem] px-1.5 py-0 gap-1">
                <RepeatIcon className="size-2.5" />
                Repeats {FREQUENCY_LABELS[goal.recurringFrequency] ?? "weekly"}
                {goal.recurringInterval > 1 && ` (every ${goal.recurringInterval})`}
              </Badge>
            )}
            {goal.recurringSourceId && (
              <button
                type="button"
                onClick={() => selectGoal(goal.recurringSourceId)}
                className="text-[0.65rem] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <RepeatIcon className="size-2.5" />
                Instance of template
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={handleEditAll} title="Edit all fields">
            <PencilIcon className="size-3.5" />
          </Button>
          {!isMobileOverlay && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close">
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Status and Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <GoalStatusSelect
              goalId={goalId}
              currentStatus={goal.status}
              parentId={goal.parentId}
              horizon={goal.horizon}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select value={goal.priority} onValueChange={handlePriorityChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  <GoalPriorityBadge priority={goal.priority} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Recurring streak info (templates only) */}
        {goal.isRecurring && !goal.recurringSourceId && (
          <div className="flex items-center gap-4 rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5">
              <FlameIcon className="size-4 text-orange-500" />
              <span className="text-sm font-medium">{goal.currentStreak}</span>
              <span className="text-xs text-muted-foreground">current streak</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FlameIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{goal.longestStreak}</span>
              <span className="text-xs text-muted-foreground">best</span>
            </div>
          </div>
        )}

        {/* SMART fields (only for YEARLY/QUARTERLY) */}
        {SMART_HORIZONS.has(goal.horizon) && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              SMART Goal Fields
            </p>
            {SMART_FIELDS.map((sf) => (
              <div key={sf.key} className="space-y-1">
                <Label className="text-xs">{sf.label}</Label>
                {editingField === sf.key ? (
                  <Textarea
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveField(sf.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingField(null);
                    }}
                    rows={2}
                    placeholder={sf.placeholder}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(sf.key, goal[sf.key] ?? "")}
                    className="w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                  >
                    {goal[sf.key] ? (
                      <span>{goal[sf.key]}</span>
                    ) : (
                      <span className="text-muted-foreground">Click to add...</span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Measurable target */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TargetIcon className="size-4 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Measurable Target</Label>
          </div>
          {goal.targetValue != null ? (
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-lg font-semibold">
                  {goal.currentValue ?? 0}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="font-mono text-lg">{goal.targetValue}</span>
                {goal.unit && (
                  <span className="text-sm text-muted-foreground">{goal.unit}</span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(
                      goal.targetValue > 0
                        ? ((goal.currentValue ?? 0) / goal.targetValue) * 100
                        : 0,
                      100
                    )}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <ProgressIncrement
                  goalId={goalId}
                  unit={goal.unit}
                  currentValue={goal.currentValue}
                  targetValue={goal.targetValue}
                />
                <ProgressHistorySheet goalId={goalId} goalTitle={goal.title} />
              </div>
            </div>
          ) : showTargetInputs ? (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Target</Label>
                <Input
                  type="number"
                  value={targetValueInput}
                  onChange={(e) => setTargetValueInput(e.target.value)}
                  placeholder="e.g., 100"
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value)}
                  placeholder="e.g., km"
                  className="w-24"
                />
              </div>
              <Button size="sm" onClick={saveTarget}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowTargetInputs(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTargetInputs(true)}
              className="text-muted-foreground"
            >
              Set a measurable target
            </Button>
          )}
        </div>

        {/* Deadline */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Deadline</Label>
          <Input
            type="date"
            value={goal.deadline ? format(new Date(goal.deadline), "yyyy-MM-dd") : ""}
            onChange={(e) => handleDeadlineChange(e.target.value)}
            className="w-fit"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Notes</Label>
          {editingField === "notes" ? (
            <Textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveField("notes")}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingField(null);
              }}
              rows={3}
              placeholder="Any additional notes..."
            />
          ) : (
            <button
              type="button"
              onClick={() => startEditing("notes", goal.notes ?? "")}
              className="w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted transition-colors min-h-[2rem]"
            >
              {goal.notes ? (
                <span className="whitespace-pre-wrap">{goal.notes}</span>
              ) : (
                <span className="text-muted-foreground">Click to add notes...</span>
              )}
            </button>
          )}
        </div>

        <Separator />

        {/* Children */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Sub-goals ({children.length})
          </Label>
          <ChildrenList
            goals={children}
            parentHorizon={goal.horizon}
            onSelectGoal={(id) => selectGoal(id)}
          />
        </div>

        <Separator />

        {/* Danger zone */}
        <div className="space-y-2">
          <Label className="text-xs text-destructive">Danger Zone</Label>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2Icon className="size-3.5" />
            Delete Goal
          </Button>
        </div>
      </div>

      <GoalDeleteDialog
        goalId={goalId}
        goalTitle={goal.title}
        childCount={children.length}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}
