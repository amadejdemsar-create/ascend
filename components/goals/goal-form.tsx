"use client";

import { useState } from "react";
import type { CreateGoalInput, UpdateGoalInput } from "@/lib/validations";
import { HORIZON_ORDER } from "@/lib/constants";
import { GoalParentSelect } from "@/components/goals/goal-parent-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GoalFormProps {
  mode: "create" | "edit";
  initialData?: Partial<CreateGoalInput & { id: string }>;
  onSubmit: (data: CreateGoalInput | UpdateGoalInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const SMART_HORIZONS = new Set(["YEARLY", "QUARTERLY"]);

export function GoalForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: GoalFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [horizon, setHorizon] = useState<string>(initialData?.horizon ?? "WEEKLY");
  const [priority, setPriority] = useState<string>(initialData?.priority ?? "MEDIUM");
  const [deadline, setDeadline] = useState(
    initialData?.deadline ? initialData.deadline.slice(0, 10) : ""
  );
  const [parentId, setParentId] = useState<string | undefined>(
    initialData?.parentId ?? undefined
  );
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [specific, setSpecific] = useState(initialData?.specific ?? "");
  const [measurable, setMeasurable] = useState(initialData?.measurable ?? "");
  const [attainable, setAttainable] = useState(initialData?.attainable ?? "");
  const [relevant, setRelevant] = useState(initialData?.relevant ?? "");
  const [timely, setTimely] = useState(initialData?.timely ?? "");
  const [targetValue, setTargetValue] = useState<string>(
    initialData?.targetValue?.toString() ?? ""
  );
  const [unit, setUnit] = useState(initialData?.unit ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [titleError, setTitleError] = useState("");

  const showSmartFields = SMART_HORIZONS.has(horizon);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError("Title is required");
      return;
    }
    setTitleError("");

    const data: CreateGoalInput = {
      title: title.trim(),
      horizon: horizon as CreateGoalInput["horizon"],
      priority: priority as CreateGoalInput["priority"],
      ...(description && { description }),
      ...(parentId && { parentId }),
      ...(deadline && { deadline: new Date(deadline).toISOString() }),
      ...(showSmartFields && specific && { specific }),
      ...(showSmartFields && measurable && { measurable }),
      ...(showSmartFields && attainable && { attainable }),
      ...(showSmartFields && relevant && { relevant }),
      ...(showSmartFields && timely && { timely }),
      ...(targetValue && { targetValue: Number(targetValue) }),
      ...(unit && { unit }),
      ...(notes && { notes }),
    };

    onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="goal-title">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="goal-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError("");
          }}
          placeholder="What do you want to achieve?"
          aria-invalid={!!titleError}
        />
        {titleError && (
          <p className="text-sm text-destructive">{titleError}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="goal-description">Description</Label>
        <Textarea
          id="goal-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={2}
        />
      </div>

      {/* Horizon + Priority row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Horizon</Label>
          <Select
            value={horizon}
            onValueChange={(val) => {
              setHorizon(val as string);
              // Reset parent when horizon changes
              setParentId(undefined);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZON_ORDER.map((h) => (
                <SelectItem key={h} value={h}>
                  {h.charAt(0) + h.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={priority}
            onValueChange={(val) => setPriority(val as string)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Deadline */}
      <div className="space-y-2">
        <Label htmlFor="goal-deadline">Deadline</Label>
        <Input
          id="goal-deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      {/* Parent select */}
      <GoalParentSelect
        horizon={horizon}
        value={parentId}
        onChange={setParentId}
      />

      {/* Category select (placeholder) */}
      <div className="space-y-2">
        <Label>Category</Label>
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Category selection coming in Phase 3" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="placeholder">Placeholder</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* SMART fields (only for yearly/quarterly) */}
      {showSmartFields && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            SMART Goal Fields
          </p>
          <div className="space-y-2">
            <Label htmlFor="goal-specific">Specific</Label>
            <Textarea
              id="goal-specific"
              value={specific}
              onChange={(e) => setSpecific(e.target.value)}
              placeholder="What exactly will you accomplish?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-measurable">Measurable</Label>
            <Textarea
              id="goal-measurable"
              value={measurable}
              onChange={(e) => setMeasurable(e.target.value)}
              placeholder="How will you measure success?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-attainable">Attainable</Label>
            <Textarea
              id="goal-attainable"
              value={attainable}
              onChange={(e) => setAttainable(e.target.value)}
              placeholder="Is this goal realistic and achievable?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-relevant">Relevant</Label>
            <Textarea
              id="goal-relevant"
              value={relevant}
              onChange={(e) => setRelevant(e.target.value)}
              placeholder="Why does this goal matter?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-timely">Timely</Label>
            <Textarea
              id="goal-timely"
              value={timely}
              onChange={(e) => setTimely(e.target.value)}
              placeholder="What is the timeline and key milestones?"
              rows={2}
            />
          </div>
        </div>
      )}

      {/* Target value + Unit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="goal-target">Target Value</Label>
          <Input
            id="goal-target"
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="e.g., 100"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal-unit">Unit</Label>
          <Input
            id="goal-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g., clients, articles, km"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="goal-notes">Notes</Label>
        <Textarea
          id="goal-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes..."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : mode === "create"
              ? "Create Goal"
              : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
