"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateGoal } from "@/lib/hooks/use-goals";
import { HORIZON_ORDER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon } from "lucide-react";

const HORIZON_ABBREV: Record<string, string> = {
  YEARLY: "Y",
  QUARTERLY: "Q",
  MONTHLY: "M",
  WEEKLY: "W",
};

export function QuickAdd() {
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<string>("WEEKLY");
  const createGoal = useCreateGoal();

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;

    try {
      await createGoal.mutateAsync({
        title: trimmed,
        horizon: horizon as "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY",
        priority: "MEDIUM",
      });
      toast.success("Goal created!");
      setTitle("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    }
  }

  // Zod caps goal titles at 200 chars. Surface a counter once the user
  // crosses the 90% threshold so they aren't surprised by a rejected submit. (L14)
  const titleLength = title.length;
  const showCounter = titleLength > 180;
  const atLimit = titleLength >= 200;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 rounded-lg border border-border p-1.5 min-w-0">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Quick add a goal..."
          className="flex-1 border-0 shadow-none focus-visible:ring-0"
          disabled={createGoal.isPending}
          maxLength={200}
        />
        <Select
          value={horizon}
          onValueChange={(val) => setHorizon(val as string)}
        >
          <SelectTrigger size="sm" className="w-14 shrink-0">
            <SelectValue>
              {HORIZON_ABBREV[horizon]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HORIZON_ORDER.map((h) => (
              <SelectItem key={h} value={h}>
                {HORIZON_ABBREV[h]} {h.charAt(0) + h.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="icon-sm"
          onClick={handleCreate}
          disabled={!title.trim() || createGoal.isPending}
          aria-label="Add goal"
          title={!title.trim() ? "Type a title first" : "Add goal"}
        >
          <PlusIcon />
        </Button>
      </div>
      {showCounter && (
        <div className={`px-2 text-xs tabular-nums ${atLimit ? "text-destructive" : "text-muted-foreground"}`}>
          {titleLength}/200
        </div>
      )}
    </div>
  );
}
