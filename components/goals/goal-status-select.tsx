"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useUpdateGoal } from "@/lib/hooks/use-goals";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started", color: "bg-muted-foreground" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-500" },
  { value: "COMPLETED", label: "Completed", color: "bg-green-500" },
  { value: "ABANDONED", label: "Abandoned", color: "bg-red-400" },
] as const;

interface GoalStatusSelectProps {
  goalId: string;
  currentStatus: string;
  parentId?: string | null;
  onStatusChange?: (newStatus: string) => void;
}

export function GoalStatusSelect({
  goalId,
  currentStatus,
  parentId,
  onStatusChange,
}: GoalStatusSelectProps) {
  const updateGoal = useUpdateGoal();
  const [pending, setPending] = useState(false);

  async function handleChange(newStatus: string | null) {
    if (!newStatus || newStatus === currentStatus) return;
    setPending(true);
    try {
      await updateGoal.mutateAsync({
        id: goalId,
        data: { status: newStatus as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED" },
      });
      onStatusChange?.(newStatus);

      if (newStatus === "COMPLETED" && parentId) {
        checkParentRollup(parentId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function checkParentRollup(pid: string) {
    try {
      const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;
      const res = await fetch(`/api/goals/${pid}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
      });
      if (!res.ok) return;

      const parent = await res.json();
      const children = parent.children as Array<{ status: string }>;
      if (!children || children.length === 0) return;

      const allComplete = children.every((c) => c.status === "COMPLETED");
      if (allComplete) {
        toast("All sub-goals complete! Complete parent?", {
          action: {
            label: "Complete parent",
            onClick: () => completeParent(pid),
          },
          duration: 8000,
        });
      }
    } catch {
      // Silently ignore rollup check failures
    }
  }

  async function completeParent(pid: string) {
    try {
      await updateGoal.mutateAsync({
        id: pid,
        data: { status: "COMPLETED" },
      });
      toast.success("Parent goal completed!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete parent";
      toast.error(message);
    }
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={handleChange}
      disabled={pending}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span
              className={`inline-block size-2 rounded-full ${STATUS_OPTIONS.find((s) => s.value === currentStatus)?.color ?? "bg-muted-foreground"}`}
            />
            {STATUS_OPTIONS.find((s) => s.value === currentStatus)?.label ?? currentStatus}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="flex items-center gap-2">
              <span className={`inline-block size-2 rounded-full ${opt.color}`} />
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
