"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateTodo } from "@/lib/hooks/use-todos";
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

const PRIORITY_ABBREV: Record<string, string> = {
  HIGH: "H",
  MEDIUM: "M",
  LOW: "L",
};

const PRIORITY_ORDER = ["HIGH", "MEDIUM", "LOW"] as const;

export function TodoQuickAdd() {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const createTodo = useCreateTodo();

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;

    try {
      await createTodo.mutateAsync({
        title: trimmed,
        priority: priority as "LOW" | "MEDIUM" | "HIGH",
      });
      toast.success("Todo created!");
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
    <div className="flex items-center gap-1.5 rounded-lg border border-border p-1.5 min-w-0">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Quick add a to-do..."
        className="flex-1 border-0 shadow-none focus-visible:ring-0"
        disabled={createTodo.isPending}
      />
      <Select
        value={priority}
        onValueChange={(val) => { if (val) setPriority(val); }}
      >
        <SelectTrigger size="sm" className="w-14 shrink-0">
          <SelectValue>
            {PRIORITY_ABBREV[priority]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_ORDER.map((p) => (
            <SelectItem key={p} value={p}>
              {PRIORITY_ABBREV[p]} {p.charAt(0) + p.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="icon-sm"
        onClick={handleCreate}
        disabled={!title.trim() || createTodo.isPending}
        aria-label="Add to-do"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
