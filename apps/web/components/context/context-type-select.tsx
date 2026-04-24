"use client";

import { toast } from "sonner";
import {
  FileText,
  BookOpen,
  Briefcase,
  User,
  CheckCircle,
  HelpCircle,
  Target,
} from "lucide-react";
import { CONTEXT_ENTRY_TYPE_VALUES, type ContextEntryType } from "@ascend/core";
import { nodeColor } from "@ascend/graph";
import { useUpdateContextType } from "@/lib/hooks/use-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Label + icon maps ─────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<ContextEntryType, string> = {
  NOTE: "Note",
  SOURCE: "Source",
  PROJECT: "Project",
  PERSON: "Person",
  DECISION: "Decision",
  QUESTION: "Question",
  AREA: "Area",
};

const ENTRY_TYPE_ICONS: Record<ContextEntryType, typeof FileText> = {
  NOTE: FileText,
  SOURCE: BookOpen,
  PROJECT: Briefcase,
  PERSON: User,
  DECISION: CheckCircle,
  QUESTION: HelpCircle,
  AREA: Target,
};

export { ENTRY_TYPE_LABELS, ENTRY_TYPE_ICONS };

// ── Component ─────────────────────────────────────────────────────

interface ContextTypeSelectProps {
  entryId: string;
  currentType: ContextEntryType;
}

export function ContextTypeSelect({
  entryId,
  currentType,
}: ContextTypeSelectProps) {
  const updateType = useUpdateContextType();

  function handleChange(value: ContextEntryType) {
    if (value === currentType) return;
    updateType.mutate(
      { id: entryId, type: value },
      {
        onSuccess: () => {
          toast.success(`Type changed to ${ENTRY_TYPE_LABELS[value]}`);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to update type",
          );
        },
      },
    );
  }

  const CurrentIcon = ENTRY_TYPE_ICONS[currentType];
  const color = nodeColor(currentType);

  return (
    <Select
      value={currentType}
      onValueChange={(val) => handleChange(val as ContextEntryType)}
      disabled={updateType.isPending}
    >
      <SelectTrigger
        size="sm"
        aria-label="Entry type"
        className="gap-1.5 text-xs"
      >
        <SelectValue>
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <CurrentIcon className="size-3" style={{ color }} aria-hidden="true" />
          <span>{ENTRY_TYPE_LABELS[currentType]}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {CONTEXT_ENTRY_TYPE_VALUES.map((type) => {
          const Icon = ENTRY_TYPE_ICONS[type];
          const c = nodeColor(type);
          return (
            <SelectItem key={type} value={type}>
              <span
                className="inline-block size-2 rounded-full shrink-0"
                style={{ backgroundColor: c }}
                aria-hidden="true"
              />
              <Icon className="size-3.5" style={{ color: c }} aria-hidden="true" />
              <span>{ENTRY_TYPE_LABELS[type]}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
