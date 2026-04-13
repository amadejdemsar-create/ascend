"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { SortableHeader } from "@/components/goals/sortable-header";
import { useUIStore } from "@/lib/stores/ui-store";

export interface GoalListItem {
  id: string;
  title: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  horizon: "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY";
  priority: "LOW" | "MEDIUM" | "HIGH";
  progress: number;
  deadline: string | null;
  parentId: string | null;
  _depth?: number;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  children?: Array<{ id: string }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  NOT_STARTED: { label: "Not Started", variant: "outline" },
  IN_PROGRESS: { label: "In Progress", variant: "secondary" },
  COMPLETED: { label: "Completed", variant: "default" },
  ABANDONED: { label: "Abandoned", variant: "destructive" },
};

const HORIZON_LABELS: Record<string, string> = {
  YEARLY: "Yearly",
  QUARTERLY: "Quarterly",
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
};

function TitleCell({ id, title, depth, childCount }: { id: string; title: string; depth: number; childCount: number }) {
  const selectGoal = useUIStore((s) => s.selectGoal);
  return (
    <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 1.25}rem` }}>
      {depth > 0 && (
        <span className="mr-0.5 text-muted-foreground/40 text-xs">└</span>
      )}
      <button
        type="button"
        className="max-w-[200px] truncate text-left font-medium hover:underline"
        onClick={() => selectGoal(id)}
      >
        {title}
      </button>
      {childCount > 0 && (
        <span className="text-[0.6rem] text-muted-foreground bg-muted rounded px-1 py-0.5 leading-none">
          {childCount}
        </span>
      )}
    </div>
  );
}

export const columns: ColumnDef<GoalListItem>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <SortableHeader column={column} title="Title" />,
    cell: ({ row }) => (
      <TitleCell id={row.original.id} title={row.original.title} depth={row.original._depth ?? 0} childCount={row.original.children?.length ?? 0} />
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.original.status;
      const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_STARTED;
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
  },
  {
    accessorKey: "progress",
    header: ({ column }) => (
      <SortableHeader column={column} title="Progress" />
    ),
    cell: ({ row }) => {
      const progress = row.original.progress;
      return (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <SortableHeader column={column} title="Priority" />
    ),
    cell: ({ row }) => (
      <GoalPriorityBadge priority={row.original.priority} />
    ),
  },
  {
    accessorKey: "deadline",
    header: ({ column }) => (
      <SortableHeader column={column} title="Deadline" />
    ),
    cell: ({ row }) => {
      const deadline = row.original.deadline;
      if (!deadline) {
        return (
          <span className="text-xs text-muted-foreground">No deadline</span>
        );
      }
      return (
        <span className="text-sm">
          {format(new Date(deadline), "MMM d, yyyy")}
        </span>
      );
    },
  },
  {
    id: "category",
    header: "Category",
    enableSorting: false,
    cell: ({ row }) => {
      const category = row.original.category;
      if (!category) return null;
      return (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <span className="text-sm">{category.name}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "horizon",
    header: ({ column }) => (
      <SortableHeader column={column} title="Horizon" />
    ),
    cell: ({ row }) => {
      const horizon = row.original.horizon;
      return (
        <Badge variant="outline" className="text-xs">
          {HORIZON_LABELS[horizon] ?? horizon}
        </Badge>
      );
    },
  },
];
