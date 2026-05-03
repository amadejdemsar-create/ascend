"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { DatabaseRowResponse } from "@/lib/hooks/use-database-rows";

// ── Types ─────────────────────────────────────────────────────────────────

export interface CalendarRowChipProps {
  row: DatabaseRowResponse;
  primaryFieldId: string;
  /** The date key (yyyy-MM-dd) of the cell this chip is rendered in. */
  sourceDateKey: string;
  onClick: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Compact chip representing a single database row in the calendar grid.
 *
 * Renders the primary field value as a single-line, ellipsed label.
 * The chip is also the drag handle for DnD date reassignment.
 */
export function CalendarRowChip({
  row,
  primaryFieldId,
  sourceDateKey,
  onClick,
}: CalendarRowChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: row.id,
    data: { sourceDateKey },
  });

  const primaryValue = row.properties[primaryFieldId];
  const displayTitle =
    typeof primaryValue === "string" && primaryValue.trim()
      ? primaryValue
      : "(Untitled)";

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "w-full rounded px-1.5 py-0.5 text-left text-xs font-medium truncate",
        "bg-primary/10 text-primary hover:bg-primary/20",
        "transition-colors cursor-grab active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-50",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      aria-label={`Row: ${displayTitle}`}
      data-dragging={isDragging || undefined}
      {...attributes}
      {...listeners}
    >
      {displayTitle}
    </button>
  );
}
