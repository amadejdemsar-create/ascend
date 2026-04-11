"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";
import type { CreateGoalInput, UpdateGoalInput } from "@/lib/validations";
import { HORIZON_ORDER } from "@/lib/constants";
import { horizonItems, priorityItems } from "@/lib/enum-display";
import { useCategories } from "@/lib/hooks/use-categories";
import { GoalParentSelect } from "@/components/goals/goal-parent-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RECURRING_HORIZONS = new Set(["WEEKLY", "MONTHLY"]);

interface GoalFormProps {
  mode: "create" | "edit";
  initialData?: Partial<CreateGoalInput & { id: string }>;
  onSubmit: (data: CreateGoalInput | UpdateGoalInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const SMART_HORIZONS = new Set(["YEARLY", "QUARTERLY"]);

interface CategoryTreeNode {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  children: CategoryTreeNode[];
}

interface FlatCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  depth: number;
}

function flattenCategoryTree(nodes: CategoryTreeNode[], depth = 0): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, color: node.color, icon: node.icon, depth });
    if (node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children, depth + 1));
    }
  }
  return result;
}

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
  const [categoryId, setCategoryId] = useState<string | undefined>(
    (initialData as Record<string, unknown> | undefined)?.categoryId as string | undefined
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [isRecurring, setIsRecurring] = useState(
    (initialData as Record<string, unknown> | undefined)?.isRecurring === true
  );
  const [recurringFrequency, setRecurringFrequency] = useState<string>(
    ((initialData as Record<string, unknown> | undefined)?.recurringFrequency as string) ?? "WEEKLY"
  );
  const [recurringInterval, setRecurringInterval] = useState<string>(
    ((initialData as Record<string, unknown> | undefined)?.recurringInterval as number)?.toString() ?? "1"
  );
  const [titleError, setTitleError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (mode === "edit") {
      return !!(initialData?.description || initialData?.deadline || initialData?.parentId ||
                initialData?.targetValue || initialData?.unit || initialData?.notes ||
                initialData?.specific || initialData?.measurable || initialData?.attainable ||
                initialData?.relevant || initialData?.timely);
    }
    return false;
  });

  const { data: categoryTree } = useCategories();
  const flatCategories = flattenCategoryTree((categoryTree ?? []) as CategoryTreeNode[]);

  const showSmartFields = SMART_HORIZONS.has(horizon);
  const showRecurring = RECURRING_HORIZONS.has(horizon);

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
      ...(categoryId && { categoryId }),
      ...(deadline && { deadline: new Date(deadline).toISOString() }),
      ...(showSmartFields && specific && { specific }),
      ...(showSmartFields && measurable && { measurable }),
      ...(showSmartFields && attainable && { attainable }),
      ...(showSmartFields && relevant && { relevant }),
      ...(showSmartFields && timely && { timely }),
      ...(targetValue && { targetValue: Number(targetValue) }),
      ...(unit && { unit }),
      ...(notes && { notes }),
      ...(showRecurring && isRecurring && {
        isRecurring: true,
        recurringFrequency: recurringFrequency as "DAILY" | "WEEKLY" | "MONTHLY",
        recurringInterval: Number(recurringInterval) || 1,
      }),
    };

    onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* === Basic Fields (always visible) === */}

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

      {/* Horizon + Priority row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Horizon</Label>
          <Select
            items={horizonItems}
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
              {horizonItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            items={priorityItems}
            value={priority}
            onValueChange={(val) => setPriority(val as string)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category select */}
      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={categoryId}
          onValueChange={(val) =>
            setCategoryId(!val || val === "__none__" ? undefined : val)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No category</SelectItem>
            {flatCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-2" style={{ paddingLeft: cat.depth > 0 ? `${cat.depth * 16}px` : undefined }}>
                  {cat.depth > 0 && (
                    <span className="text-[10px] text-muted-foreground/50">&#x2514;</span>
                  )}
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <DynamicIcon
                    name={(cat.icon ?? "folder") as IconName}
                    className="size-3.5 shrink-0"
                  />
                  <span>{cat.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* === Advanced Fields Toggle === */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <ChevronRight className={cn("size-4 transition-transform", showAdvanced && "rotate-90")} />
        Advanced options
      </button>

      {showAdvanced && (
        <div className="space-y-4">
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

          {/* Recurring goal fields (WEEKLY/MONTHLY horizons only) */}
          {showRecurring && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Recurring Goal</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically generate new instances on a schedule
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isRecurring}
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                    isRecurring ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform ${
                      isRecurring ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {isRecurring && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={recurringFrequency}
                      onValueChange={(val) => setRecurringFrequency(val as string)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurring-interval">Every N periods</Label>
                    <Input
                      id="recurring-interval"
                      type="number"
                      min={1}
                      value={recurringInterval}
                      onChange={(e) => setRecurringInterval(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
