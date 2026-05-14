"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useUpdateLayout,
  type CanvasLayoutListItem,
} from "@/lib/hooks/use-canvas";
import { toast } from "sonner";

interface Props {
  layout: CanvasLayoutListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CanvasLayoutRenameDialog({ layout, open, onOpenChange }: Props) {
  const [name, setName] = useState(layout.name);
  const update = useUpdateLayout();

  useEffect(() => {
    setName(layout.name);
  }, [layout.name]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === layout.name) {
      onOpenChange(false);
      return;
    }
    try {
      await update.mutateAsync({ id: layout.id, input: { name: trimmed } });
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to rename layout.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename layout</DialogTitle>
          <DialogDescription>
            Give this canvas a new name. The URL slug stays the same.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
            if (e.key === "Escape") onOpenChange(false);
          }}
          autoFocus
          maxLength={200}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
