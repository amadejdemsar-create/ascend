"use client";

import { useCallback } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────

interface TableAddRowProps {
  onAddRow: () => void;
  isPending: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Sticky footer row with a "+ Add row" button. Clicking creates a new
 * empty row in the database.
 */
export function TableAddRow({ onAddRow, isPending }: TableAddRowProps) {
  const handleClick = useCallback(() => {
    onAddRow();
  }, [onAddRow]);

  return (
    <div
      className="sticky bottom-0 left-0 flex items-center h-9 px-2 border-t border-border bg-background/95 backdrop-blur-sm z-10"
      role="row"
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={handleClick}
        disabled={isPending}
        aria-label="Add new row"
      >
        <PlusIcon className="size-3.5" aria-hidden="true" />
        Add row
      </Button>
    </div>
  );
}
