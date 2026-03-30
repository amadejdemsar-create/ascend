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

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-1.5">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Quick add a goal..."
        className="flex-1 border-0 shadow-none focus-visible:ring-0"
        disabled={createGoal.isPending}
      />
      <Select
        value={horizon}
        onValueChange={(val) => setHorizon(val as string)}
      >
        <SelectTrigger size="sm" className="w-12 shrink-0">
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
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
