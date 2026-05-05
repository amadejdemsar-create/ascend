"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangleIcon } from "lucide-react";
import { useBranch } from "@/lib/hooks/use-versions";
import type { NodeType } from "@/lib/validations";
import { fireBranchConfetti } from "@/lib/confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface BranchDialogProps {
  open: boolean;
  onClose: () => void;
  versionId: string;
  nodeType: NodeType;
  nodeId: string;
  sourceTitle: string;
  derivativeCount: number;
  onBranched?: (newNodeId: string) => void;
}

export function BranchDialog({
  open,
  onClose,
  versionId,
  nodeType,
  nodeId,
  sourceTitle,
  derivativeCount,
  onBranched,
}: BranchDialogProps) {
  const [title, setTitle] = useState(`${sourceTitle} (branch)`);
  const branch = useBranch();

  // Reset title when dialog opens with a new source
  const titleDefault = `${sourceTitle} (branch)`;

  async function handleBranch() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Title is required");
      return;
    }

    try {
      const result = await branch.mutateAsync({
        versionId,
        title: trimmed,
        nodeType,
        nodeId,
      });
      fireBranchConfetti();
      onClose();
      onBranched?.(result.newNodeId);
    } catch (err) {
      // The error message from the API includes "50 derivatives" when cap is hit.
      const message = err instanceof Error ? err.message : "Branch failed";
      if (message.includes("50 derivatives") || message.includes("derivative")) {
        // Hard cap reached: display inline rather than toast so user sees it clearly
        toast.error("Cannot branch: derivative cap (50) reached for this source.");
      } else {
        toast.error(message);
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Branch from version</DialogTitle>
          <DialogDescription>
            Create a new entry initialized from this version&apos;s state. A
            DERIVED_FROM link will connect it back to the source.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Soft warning */}
          {derivativeCount > 5 && (
            <div
              className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300"
              role="alert"
            >
              <AlertTriangleIcon className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                This source already has {derivativeCount} branches. Continue?
              </span>
            </div>
          )}

          {/* Title input */}
          <div className="space-y-2">
            <Label htmlFor="branch-title">New entry title</Label>
            <Input
              id="branch-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !branch.isPending) handleBranch();
              }}
              placeholder={titleDefault}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={branch.isPending}>
            Cancel
          </Button>
          <Button onClick={handleBranch} disabled={branch.isPending || !title.trim()}>
            {branch.isPending ? "Branching..." : "Branch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
