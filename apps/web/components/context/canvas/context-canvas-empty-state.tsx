"use client";

import { Map as MapIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onQuickAddRecent: () => void;
  isQuickAddPending: boolean;
}

/**
 * Wave 9: Centered card shown on an empty canvas layout. Two affordances:
 *   - Hint to drag entries from the sidebar.
 *   - Quick-add button that drops the 5 most-recently-updated entries
 *     into a row at the canvas origin (implemented in Phase 5).
 */
export function ContextCanvasEmptyState({
  onQuickAddRecent,
  isQuickAddPending,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-4 rounded-xl border bg-background/95 p-6 text-center shadow-sm backdrop-blur">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <MapIcon className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight">
            Your canvas is empty
          </h3>
          <p className="text-sm text-muted-foreground">
            Drag entries from the sidebar to start arranging them spatially,
            or use the quick-add to drop your 5 most recent.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onQuickAddRecent}
          disabled={isQuickAddPending}
        >
          <Sparkles className="mr-2 size-4" aria-hidden="true" />
          {isQuickAddPending ? "Adding..." : "Quick-add 5 recent entries"}
        </Button>
      </div>
    </div>
  );
}
