"use client";

import { useState } from "react";
import { edgeColor } from "@ascend/graph";
import type { ContextLinkType } from "@ascend/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateContextLink } from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { toast } from "sonner";
import { CANVAS_PICKER_LINK_TYPES } from "./canvas-edge-sync";
import { cn } from "@/lib/utils";

const LINK_LABELS: Record<ContextLinkType, string> = {
  REFERENCES: "References",
  EXTENDS: "Extends",
  CONTRADICTS: "Contradicts",
  SUPPORTS: "Supports",
  EXAMPLE_OF: "Example of",
  SUPERSEDES: "Supersedes",
  APPLIES_TO: "Applies to",
  PART_OF: "Part of",
  DERIVED_FROM: "Derived from",
  DATABASE_RELATION: "Database relation",
};

interface Props {
  /**
   * Called after a successful POST /api/context-links so the view
   * can tag the pending arrow with `customData.linkId`.
   */
  onConfirmed: (args: {
    pendingArrowId: string;
    linkId: string;
    linkType: ContextLinkType;
  }) => void;
  /**
   * Called on cancel / Escape / dialog close. The view removes the
   * pending arrow from the scene.
   */
  onCancelled: (pendingArrowId: string) => void;
}

/**
 * Wave 9 Phase 6: modal that opens whenever the canvas view detects
 * a new arrow connecting two card rectangles. Driven by the
 * Zustand store's `canvasLinkTypePickerOpen` field so any onChange
 * tick can request it without prop drilling.
 */
export function CanvasLinkTypePicker({ onConfirmed, onCancelled }: Props) {
  const state = useUIStore((s) => s.canvasLinkTypePickerOpen);
  const close = useUIStore((s) => s.closeCanvasLinkTypePicker);
  const createLink = useCreateContextLink();
  const [submittingType, setSubmittingType] = useState<ContextLinkType | null>(
    null,
  );

  const open = state !== null;

  function handleCancel() {
    if (state) onCancelled(state.pendingArrowId);
    close();
  }

  async function handlePick(type: ContextLinkType) {
    if (!state) return;
    setSubmittingType(type);
    try {
      const link = await createLink.mutateAsync({
        fromEntryId: state.fromEntryId,
        toEntryId: state.toEntryId,
        type,
        source: "CANVAS",
      });
      onConfirmed({
        pendingArrowId: state.pendingArrowId,
        linkId: link.id,
        linkType: type,
      });
      close();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create link. Please try again.",
      );
    } finally {
      setSubmittingType(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleCancel())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose link type</DialogTitle>
          <DialogDescription>
            Pick how the source entry relates to the target. This creates a
            typed link that also appears in the Graph view.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2">
          {CANVAS_PICKER_LINK_TYPES.map((type) => {
            const isLoading = submittingType === type;
            const color = edgeColor(type);
            return (
              <button
                key={type}
                type="button"
                disabled={submittingType !== null}
                onClick={() => handlePick(type)}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60",
                  isLoading && "ring-2 ring-primary",
                )}
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate">{LINK_LABELS[type]}</span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={submittingType !== null}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
