"use client";

import { toast } from "sonner";
import { useRestore } from "@/lib/hooks/use-versions";
import type { NodeType } from "@/lib/validations";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export interface RestoreConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  versionId: string;
  nodeType: NodeType;
  nodeId: string;
  databaseId?: string;
  versionLabel: string;
}

export function RestoreConfirmationDialog({
  open,
  onClose,
  versionId,
  nodeType,
  nodeId,
  databaseId,
  versionLabel,
}: RestoreConfirmationDialogProps) {
  const restore = useRestore();

  async function handleRestore() {
    try {
      await restore.mutateAsync({
        versionId,
        nodeType,
        nodeId,
        databaseId,
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore version?</AlertDialogTitle>
          <AlertDialogDescription>
            Restore {versionLabel}? Edges (links to other entries) will NOT be
            reverted. The current state will be saved as a new version before the
            restore.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRestore}
            disabled={restore.isPending}
          >
            {restore.isPending ? "Restoring..." : "Restore"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
