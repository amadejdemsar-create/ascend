"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useDeleteLayout,
  type CanvasLayoutListItem,
} from "@/lib/hooks/use-canvas";
import { toast } from "sonner";

interface Props {
  layout: CanvasLayoutListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (deletedId: string) => void;
}

export function CanvasLayoutDeleteDialog({
  layout,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const deleteLayout = useDeleteLayout();
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await deleteLayout.mutateAsync(layout.id);
      onDeleted(layout.id);
      onOpenChange(false);
      toast.success(`Deleted layout "${layout.name}".`);
    } catch (err) {
      // The service refuses to delete the only layout with a clear
      // error message. Surface inline rather than rethrowing.
      setError(
        err instanceof Error ? err.message : "Failed to delete layout.",
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{layout.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the canvas arrangement (annotations, freehand strokes,
            node positions) for {layout._count.nodes}{" "}
            {layout._count.nodes === 1 ? "card" : "cards"}. The underlying
            entries and any typed links between them are NOT deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteLayout.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={deleteLayout.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteLayout.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
