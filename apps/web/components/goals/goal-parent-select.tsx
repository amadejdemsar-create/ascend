"use client";

import { VALID_PARENT_HORIZONS } from "@/lib/constants";
import { useGoals } from "@/lib/hooks/use-goals";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GoalParentSelectProps {
  horizon: string;
  value?: string;
  onChange: (parentId: string | undefined) => void;
}

export function GoalParentSelect({
  horizon,
  value,
  onChange,
}: GoalParentSelectProps) {
  const parentHorizon = VALID_PARENT_HORIZONS[horizon];

  // Yearly goals have no parent
  if (parentHorizon === null || parentHorizon === undefined) {
    return null;
  }

  return <ParentSelectInner parentHorizon={parentHorizon} value={value} onChange={onChange} />;
}

function ParentSelectInner({
  parentHorizon,
  value,
  onChange,
}: {
  parentHorizon: string;
  value?: string;
  onChange: (parentId: string | undefined) => void;
}) {
  const { data: goals, isLoading } = useGoals({
    horizon: parentHorizon as "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY",
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Parent Goal</Label>
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const goalList = (goals ?? []) as Array<{ id: string; title: string }>;

  return (
    <div className="space-y-2">
      <Label>Parent Goal ({parentHorizon.toLowerCase()})</Label>
      <Select
        value={value ?? ""}
        onValueChange={(val) => {
          onChange(val === "" ? undefined : (val as string));
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="No parent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">No parent</SelectItem>
          {goalList.map((goal) => (
            <SelectItem key={goal.id} value={goal.id}>
              {goal.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
