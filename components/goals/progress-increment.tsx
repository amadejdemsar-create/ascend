"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLogProgress } from "@/lib/hooks/use-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PlusIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";

interface ProgressIncrementProps {
  goalId: string;
  unit?: string | null;
  currentValue?: number | null;
  targetValue?: number | null;
}

export function ProgressIncrement({
  goalId,
  unit,
}: ProgressIncrementProps) {
  const logProgress = useLogProgress();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("1");
  const [note, setNote] = useState("");

  async function handleQuickIncrement() {
    try {
      await logProgress.mutateAsync({ goalId, data: { value: 1 } });
      toast.success(`+1 ${unit ?? ""} logged`.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to log progress";
      toast.error(message);
    }
  }

  async function handleCustomLog() {
    const amount = Number(customAmount);
    if (!amount || amount <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }
    try {
      await logProgress.mutateAsync({
        goalId,
        data: { value: amount, note: note.trim() || undefined },
      });
      toast.success(`+${amount} ${unit ?? ""} logged`.trim());
      setPopoverOpen(false);
      setCustomAmount("1");
      setNote("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to log progress";
      toast.error(message);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleQuickIncrement}
        disabled={logProgress.isPending}
        className="gap-1"
      >
        {logProgress.isPending ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <PlusIcon className="size-3.5" />
        )}
        1
      </Button>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={<Button variant="outline" size="icon-sm" />}
        >
          <ChevronDownIcon className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3" align="start">
          <div className="space-y-1">
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              min={1}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleCustomLog}
            disabled={logProgress.isPending}
          >
            {logProgress.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              "Log"
            )}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
