"use client";

import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PropertyCell } from "@/components/databases/property-editors";
import type { DatabaseField } from "@ascend/core";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";
import type { DatabaseRowResponse } from "@/lib/hooks/use-database-rows";

// ── Types ─────────────────────────────────────────────────────────────────

export interface CalendarDayDetailProps {
  date: Date;
  rows: DatabaseRowResponse[];
  primaryFieldId: string;
  /** Fields to show as secondary properties (up to 2). */
  visibleFields: DatabaseFieldResponse[];
  onOpenRow: (rowEntryId: string) => void;
  /** Label for the trigger (e.g. "+ 3 more"). */
  triggerLabel: string;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Popover showing all rows for a given date in the calendar view.
 *
 * Anchored to the "+ N more" link inside a calendar cell. Each row renders
 * the primary field and up to 2 visible property values via PropertyCell.
 */
export function CalendarDayDetail({
  date,
  rows,
  primaryFieldId,
  visibleFields,
  onOpenRow,
  triggerLabel,
}: CalendarDayDetailProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="w-full text-left px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
      >
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        sideOffset={4}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h4 className="text-sm font-medium text-foreground">
            {format(date, "EEEE, d. M. yyyy")}
          </h4>
        </div>

        {/* Row list */}
        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
          {rows.map((row) => {
            const primaryValue = row.properties[primaryFieldId];
            const displayTitle =
              typeof primaryValue === "string" && primaryValue.trim()
                ? primaryValue
                : "(Untitled)";

            return (
              <button
                key={row.id}
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onOpenRow(row.entryId)}
                aria-label={`Open row: ${displayTitle}`}
              >
                <p className="text-sm font-medium text-foreground truncate">
                  {displayTitle}
                </p>
                {visibleFields.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {visibleFields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <span className="shrink-0 truncate max-w-[60px]">
                          {field.name}:
                        </span>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <PropertyCell
                            field={field as unknown as DatabaseField}
                            value={row.properties[field.id]}
                            onChange={() => {}}
                            mode="cell"
                            disabled
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
