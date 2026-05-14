"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import type { AutosaveStatus } from "@/lib/hooks/use-canvas-autosave";
import { cn } from "@/lib/utils";

interface Props {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  onRetry: () => void;
}

/**
 * Wave 9: tiny toolbar pill that reflects the canvas autosave state.
 *  idle    -> hidden (nothing to say)
 *  saving  -> spinner + "Saving..."
 *  saved   -> check + "Saved 3s ago" (live distance)
 *  failed  -> alert + "Save failed - Retry"
 */
export function CanvasSaveStatus({ status, lastSavedAt, onRetry }: Props) {
  const [, force] = useState(0);
  // Re-render once every 10s while saved so the relative time updates.
  useEffect(() => {
    if (status !== "saved" || lastSavedAt === null) return;
    const id = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, [status, lastSavedAt]);

  if (status === "idle") return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs shadow-sm",
        status === "failed" && "border-destructive/40 text-destructive",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-muted-foreground",
      )}
      role="status"
      aria-live="polite"
    >
      {status === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3 text-emerald-600" aria-hidden="true" />
          <span>
            Saved
            {lastSavedAt && (
              <> {formatDistanceToNow(lastSavedAt, { addSuffix: true })}</>
            )}
          </span>
        </>
      )}
      {status === "failed" && (
        <>
          <CircleAlert className="size-3" aria-hidden="true" />
          <span>Save failed</span>
          <button
            type="button"
            className="ml-1 rounded px-1 font-medium underline-offset-2 hover:underline"
            onClick={onRetry}
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}
