"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { RepeatIcon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useChangeFieldType } from "@/lib/hooks/use-database-fields";

// ── Types ─────────────────────────────────────────────────────────────────

interface ChangeTypePopoverProps {
  databaseId: string;
  fieldId: string;
  fieldName: string;
  currentType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Allowed coercions (must match service-layer logic) ────────────────────

const ALLOWED_COERCIONS: Record<string, { type: string; label: string; warning?: string }[]> = {
  TEXT: [
    { type: "URL", label: "URL", warning: "All values must be valid URLs." },
    { type: "EMAIL", label: "Email", warning: "All values must be valid email addresses." },
    { type: "PHONE", label: "Phone", warning: "All values must be valid phone numbers." },
  ],
  NUMBER: [
    { type: "TEXT", label: "Text" },
  ],
  SELECT: [
    { type: "MULTI_SELECT", label: "Multi-select" },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Dialog for changing a database field's type. Shows allowed target types
 * and handles the force-confirmation flow when values fail validation.
 */
export function ChangeTypePopover({
  databaseId,
  fieldId,
  fieldName,
  currentType,
  open,
  onOpenChange,
}: ChangeTypePopoverProps) {
  const changeType = useChangeFieldType(databaseId);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [offendingCount, setOffendingCount] = useState<number | null>(null);
  const [confirmingForce, setConfirmingForce] = useState(false);

  const allowedTargets = ALLOWED_COERCIONS[currentType] ?? [];
  const hasTargets = allowedTargets.length > 0;

  const resetState = useCallback(() => {
    setSelectedType(null);
    setOffendingCount(null);
    setConfirmingForce(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetState();
      onOpenChange(next);
    },
    [onOpenChange, resetState],
  );

  const handleConvert = useCallback(
    async (force: boolean) => {
      if (!selectedType) return;

      try {
        const result = await changeType.mutateAsync({
          fieldId,
          newType: selectedType,
          force,
        });

        if (result.ok) {
          toast.success(`Changed "${fieldName}" to ${selectedType}`);
          handleOpenChange(false);
        } else if (result.offendingRowIds && result.offendingRowIds.length > 0) {
          setOffendingCount(result.offendingRowIds.length);
          setConfirmingForce(true);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Type change failed");
      }
    },
    [selectedType, changeType, fieldId, fieldName, handleOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change column type</DialogTitle>
          <DialogDescription>
            Convert &ldquo;{fieldName}&rdquo; from {currentType} to another type.
          </DialogDescription>
        </DialogHeader>

        {!hasTargets ? (
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              This field type cannot be converted. Delete the column and recreate it with the desired type.
            </p>
          </div>
        ) : confirmingForce ? (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2">
              <AlertTriangleIcon className="size-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Validation failed</p>
                <p className="text-xs text-muted-foreground">
                  {offendingCount} row{offendingCount !== 1 ? "s have" : " has"} invalid values that cannot be converted. Force convert sets those values to null.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setConfirmingForce(false);
                  setOffendingCount(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => handleConvert(true)}
                disabled={changeType.isPending}
              >
                {changeType.isPending ? "Converting..." : "Force convert"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              {allowedTargets.map((target) => (
                <button
                  key={target.type}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors text-left",
                    "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedType === target.type && "bg-accent ring-1 ring-primary/30",
                  )}
                  onClick={() => setSelectedType(target.type)}
                  aria-label={`Convert to ${target.label}`}
                >
                  <RepeatIcon className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="flex flex-col min-w-0">
                    <span>{target.label}</span>
                    {target.warning && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {target.warning}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {selectedType && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleConvert(false)}
                disabled={changeType.isPending}
              >
                {changeType.isPending ? "Converting..." : "Convert"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
