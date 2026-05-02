"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface CheckboxEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "CHECKBOX" }> };
  value: boolean | null;
  onChange: (next: boolean | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export function CheckboxEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
}: CheckboxEditorProps) {
  const checked = value === true;

  function handleToggle(e: React.MouseEvent) {
    // Stop propagation so clicking the checkbox in a Table row does not
    // open the row detail panel.
    e.stopPropagation();
    if (disabled) return;
    onChange(!checked);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) onChange(!checked);
    }
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={field.name}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded border transition-colors shrink-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        mode === "expanded" ? "size-5" : "size-4",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 hover:border-muted-foreground/60",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {checked && (
        <CheckIcon
          className={mode === "expanded" ? "size-3.5" : "size-3"}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
