"use client";

import { useState } from "react";
import { CheckSquare, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface TodoBulkBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onBulkComplete: () => void;
  onBulkDelete: () => void;
}

export function TodoBulkBar({
  selectedIds,
  onClearSelection,
  onBulkComplete,
  onBulkDelete,
}: TodoBulkBarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const count = selectedIds.length;

  if (count === 0) return null;

  return (
    <>
      <div
        className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg transition-all duration-200 md:bottom-6"
      >
        <span className="text-sm font-medium whitespace-nowrap">
          {count} selected
        </span>

        <Button
          size="sm"
          variant="outline"
          onClick={onBulkComplete}
          className="gap-1.5"
        >
          <CheckSquare className="size-3.5" />
          Complete
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
          className="gap-1.5"
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onClearSelection}
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(o) => setDeleteDialogOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} to-dos?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All {count} selected to-dos will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onBulkDelete();
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
