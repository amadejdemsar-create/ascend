"use client";

import { AlertCircleIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatFormulaValue, type FormulaValue } from "@/lib/formula";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface FormulaDisplayProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "FORMULA" }> };
  /** The evaluated formula value (pre-computed by the parent). null if not yet evaluated. */
  value: FormulaValue | null;
  onChange: (next: null) => void; // Formula is read-only; onChange is never called
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export function FormulaDisplay({
  field,
  value,
  mode,
}: FormulaDisplayProps) {
  const expression = field.config.expression;

  // No value yet (not evaluated)
  if (!value) {
    return (
      <span
        className={cn(
          "text-muted-foreground",
          mode === "cell" ? "text-sm px-1.5 py-1" : "text-sm",
        )}
        aria-label={`${field.name}: not computed`}
      >
        &mdash;
      </span>
    );
  }

  // Error case
  if (value.type === "error") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            className={cn(
              "inline-flex items-center gap-1 cursor-default",
              mode === "cell" ? "text-sm px-1.5 py-1" : "text-sm",
            )}
            aria-label={`${field.name}: formula error`}
          >
            <AlertCircleIcon
              className="size-3.5 text-destructive"
              aria-hidden="true"
            />
            <span className="text-destructive/80 font-mono text-xs">#ERROR</span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span className="text-xs">{value.message}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Normal case: display formatted value with expression tooltip
  const displayText = formatFormulaValue(value);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "cursor-default font-mono text-muted-foreground",
            mode === "cell" ? "text-sm px-1.5 py-1 truncate block max-w-full" : "text-sm",
          )}
          aria-label={`${field.name}: ${displayText}`}
        >
          {displayText || <span>&mdash;</span>}
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs font-mono">{expression}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
