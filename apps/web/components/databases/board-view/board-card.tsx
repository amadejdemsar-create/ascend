"use client";

import { forwardRef } from "react";
import type { DatabaseField } from "@ascend/core";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";
import { PropertyCell } from "@/components/databases/property-editors";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

export interface BoardCardProps {
  row: {
    id: string;
    entryId: string;
    properties: Record<string, unknown>;
  };
  primaryFieldId: string;
  primaryFieldName: string;
  visibleProperties: Array<{ field: DatabaseFieldResponse; value: unknown }>;
  isDragging?: boolean;
  isOverlay?: boolean;
  onOpen: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * A single card in the Board view representing one database row.
 *
 * Renders the primary field as bold title, followed by up to 3 visible
 * property values using PropertyCell in read-only cell mode. Click opens
 * the row detail.
 */
export const BoardCard = forwardRef<HTMLDivElement, BoardCardProps>(
  function BoardCard(
    {
      row,
      primaryFieldId,
      primaryFieldName,
      visibleProperties,
      isDragging,
      isOverlay,
      onOpen,
    },
    ref,
  ) {
    const primaryValue = row.properties[primaryFieldId];
    const displayTitle =
      typeof primaryValue === "string" && primaryValue.trim()
        ? primaryValue
        : "Untitled";

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-border bg-background p-3 shadow-sm",
          "hover:shadow-md transition-shadow cursor-pointer select-none",
          isDragging && "opacity-50",
          isOverlay && "shadow-lg ring-2 ring-primary/30 rotate-[2deg]",
        )}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${primaryFieldName}: ${displayTitle}`}
      >
        {/* Primary field as title */}
        <p className="text-sm font-medium text-foreground truncate mb-1.5">
          {displayTitle}
        </p>

        {/* Visible properties (read-only, cell mode) */}
        {visibleProperties.length > 0 && (
          <div className="flex flex-col gap-1">
            {visibleProperties.map(({ field, value }) => (
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
                    value={value}
                    onChange={() => {}}
                    mode="cell"
                    disabled
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
