"use client";

import { format } from "date-fns";
import {
  CalendarDays,
  Star,
  Repeat,
  Target,
  X,
  Flag,
  Tag,
} from "lucide-react";
import type { ParsedTodo, ParsedMatch } from "@/lib/natural-language/parser";

interface Props {
  parsed: ParsedTodo;
  onRemove: (type: ParsedMatch["type"]) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400",
  MEDIUM:
    "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  LOW: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400",
};

const CHIP_BASE =
  "inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs hover:bg-muted/70";

function formatFrequency(freq: "DAILY" | "WEEKLY" | "MONTHLY"): string {
  switch (freq) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return "Weekly";
    case "MONTHLY":
      return "Monthly";
  }
}

export function ParsedPreview({ parsed, onRemove }: Props) {
  const hasAnything =
    !!parsed.dueDate ||
    !!parsed.priority ||
    !!parsed.goalId ||
    !!parsed.categoryId ||
    !!parsed.isBig3 ||
    !!parsed.isRecurring;

  if (!hasAnything) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {parsed.dueDate && (
        <button
          type="button"
          onClick={() => onRemove("date")}
          className={CHIP_BASE}
          aria-label="Remove date"
        >
          <CalendarDays className="size-3" />
          <span>{format(new Date(parsed.dueDate), "d. M. yyyy")}</span>
          <X className="size-3 opacity-60" />
        </button>
      )}

      {parsed.priority && (
        <button
          type="button"
          onClick={() => onRemove("priority")}
          className={`${CHIP_BASE} ${PRIORITY_COLOR[parsed.priority] ?? ""}`}
          aria-label="Remove priority"
        >
          <Flag className="size-3" />
          <span>
            {parsed.priority.charAt(0) +
              parsed.priority.slice(1).toLowerCase()}
          </span>
          <X className="size-3 opacity-60" />
        </button>
      )}

      {parsed.goalId && parsed.goalTitle && (
        <button
          type="button"
          onClick={() => onRemove("goal")}
          className={CHIP_BASE}
          aria-label="Remove goal link"
        >
          <Target className="size-3" />
          <span className="max-w-[14ch] truncate">{parsed.goalTitle}</span>
          <X className="size-3 opacity-60" />
        </button>
      )}

      {parsed.categoryId && parsed.categoryName && (
        <button
          type="button"
          onClick={() => onRemove("category")}
          className={CHIP_BASE}
          aria-label="Remove category"
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: parsed.categoryColor ?? "#4F46E5" }}
            aria-hidden
          />
          <Tag className="size-3" />
          <span className="max-w-[14ch] truncate">{parsed.categoryName}</span>
          <X className="size-3 opacity-60" />
        </button>
      )}

      {parsed.isBig3 && (
        <button
          type="button"
          onClick={() => onRemove("big3")}
          className={CHIP_BASE}
          aria-label="Remove Big 3"
        >
          <Star className="size-3" />
          <span>Big 3</span>
          <X className="size-3 opacity-60" />
        </button>
      )}

      {parsed.isRecurring && parsed.recurringFrequency && (
        <button
          type="button"
          onClick={() => onRemove("recurring")}
          className={CHIP_BASE}
          aria-label="Remove recurring"
        >
          <Repeat className="size-3" />
          <span>{formatFrequency(parsed.recurringFrequency)}</span>
          <X className="size-3 opacity-60" />
        </button>
      )}
    </div>
  );
}
