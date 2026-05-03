"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { DatabaseField } from "@ascend/core";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";
import { PropertyCell } from "@/components/databases/property-editors";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface TableCellProps {
  field: DatabaseFieldResponse;
  value: unknown;
  isPrimary: boolean;
  onOpenRow?: () => void;
  onUpdate: (newValue: unknown) => void;
}

// Fields that cannot be edited inline via click-to-edit.
const NON_EDITABLE_TYPES = new Set(["FORMULA"]);

// Fields that toggle on single click without opening an editor.
const CLICK_TOGGLE_TYPES = new Set(["CHECKBOX"]);

// ── Component ─────────────────────────────────────────────────────────────

/**
 * A single table cell. Renders the PropertyCell in display mode by default.
 * On click, swaps to an active editor (for editable types). Primary column
 * click navigates to the row detail.
 */
export function TableCell({
  field,
  value,
  isPrimary,
  onOpenRow,
  onUpdate,
}: TableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  // Close editor on outside click.
  useEffect(() => {
    if (!isEditing) return;
    function handleClickOutside(e: MouseEvent) {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setIsEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  const handleClick = useCallback(() => {
    // Primary column click opens the row detail panel.
    if (isPrimary && onOpenRow) {
      onOpenRow();
      return;
    }

    // Non-editable types (FORMULA) do nothing on click.
    if (NON_EDITABLE_TYPES.has(field.type)) return;

    // Checkbox toggles immediately on click.
    if (CLICK_TOGGLE_TYPES.has(field.type)) {
      onUpdate(!(value as boolean | null));
      return;
    }

    // For all other types, enter edit mode.
    setIsEditing(true);
  }, [field.type, isPrimary, onOpenRow, onUpdate, value]);

  const handleChange = useCallback(
    (next: unknown) => {
      onUpdate(next);
      // For single-value fields (text, number, date, select, etc.) commit
      // closes the editor. Multi-select and relation stay open until blur.
      if (!["MULTI_SELECT", "RELATION"].includes(field.type)) {
        setIsEditing(false);
      }
    },
    [field.type, onUpdate],
  );

  // Close editor on Escape key.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && isEditing) {
        e.stopPropagation();
        setIsEditing(false);
      }
    },
    [isEditing],
  );

  // Cast field to the shape PropertyCell expects. The DatabaseFieldResponse
  // from the hook is a superset of @ascend/core's DatabaseField type; the
  // cast is safe because the server validated the config on creation.
  const fieldForEditor = field as unknown as DatabaseField;

  return (
    <div
      ref={cellRef}
      className={cn(
        "h-full w-full min-h-[36px] flex items-center px-1.5",
        isPrimary && "font-medium cursor-pointer hover:text-primary",
        !isPrimary &&
          !NON_EDITABLE_TYPES.has(field.type) &&
          "cursor-cell",
        isEditing && "ring-2 ring-primary/40 rounded-sm bg-background z-10",
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="gridcell"
      tabIndex={0}
      aria-label={`${field.name}: ${value != null ? String(value) : "empty"}`}
    >
      <PropertyCell
        field={fieldForEditor}
        value={value}
        onChange={handleChange}
        mode="cell"
        disabled={!isEditing && !CLICK_TOGGLE_TYPES.has(field.type)}
        autoFocus={isEditing}
      />
    </div>
  );
}
