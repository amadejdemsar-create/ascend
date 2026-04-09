"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { SortableHeader } from "@/components/goals/sortable-header";
import { TodoOverdueActions } from "@/components/todos/todo-overdue-actions";
import { Star, Repeat } from "lucide-react";

export interface TodoListItem {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "DONE" | "SKIPPED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  scheduledDate: string | null;
  isBig3: boolean;
  isRecurring: boolean;
  currentStreak: number;
  completedAt: string | null;
  createdAt: string;
  goal: { id: string; title: string } | null;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
}

export interface TodoTableMeta {
  isSelected: (id: string) => boolean;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  allSelected: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "outline" },
  DONE: { label: "Done", variant: "default" },
  SKIPPED: { label: "Skipped", variant: "secondary" },
};

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status !== "PENDING") return false;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

export const columns: ColumnDef<TodoListItem>[] = [
  {
    id: "select",
    header: ({ table }) => {
      const meta = table.options.meta as TodoTableMeta | undefined;
      return (
        <input
          type="checkbox"
          className="size-4 rounded border-border accent-primary cursor-pointer"
          checked={meta?.allSelected ?? false}
          onChange={() => meta?.toggleAll()}
          onClick={(e) => e.stopPropagation()}
        />
      );
    },
    cell: ({ row, table }) => {
      const meta = table.options.meta as TodoTableMeta | undefined;
      return (
        <input
          type="checkbox"
          className="size-4 rounded border-border accent-primary cursor-pointer"
          checked={meta?.isSelected(row.original.id) ?? false}
          onChange={() => meta?.toggleRow(row.original.id)}
          onClick={(e) => e.stopPropagation()}
        />
      );
    },
    enableSorting: false,
    size: 40,
  },
  {
    accessorKey: "title",
    header: ({ column }) => <SortableHeader column={column} title="Title" />,
    enableSorting: true,
    cell: ({ row }) => {
      const { title, isBig3, isRecurring } = row.original;
      return (
        <div className="flex items-center gap-1.5 max-w-[220px]">
          {isBig3 && (
            <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
          )}
          <span className="truncate font-medium">{title}</span>
          {isRecurring && (
            <Repeat className="size-3 shrink-0 text-muted-foreground" />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} title="Status" />,
    enableSorting: true,
    cell: ({ row }) => {
      const status = row.original.status;
      const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
  },
  {
    accessorKey: "priority",
    header: ({ column }) => <SortableHeader column={column} title="Priority" />,
    enableSorting: true,
    cell: ({ row }) => (
      <GoalPriorityBadge priority={row.original.priority} />
    ),
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => <SortableHeader column={column} title="Due Date" />,
    enableSorting: true,
    cell: ({ row }) => {
      const { dueDate, status, id } = row.original;
      if (!dueDate) {
        return <span className="text-xs text-muted-foreground">&mdash;</span>;
      }
      const overdue = isOverdue(dueDate, status);
      return (
        <div className="flex items-center gap-1">
          <span className={`text-sm ${overdue ? "text-destructive font-medium" : ""}`}>
            {new Date(dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          {overdue && (
            <TodoOverdueActions todoId={id} dueDate={dueDate} />
          )}
        </div>
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
    id: "goal",
    header: "Goal",
    enableSorting: false,
    cell: ({ row }) => {
      const goal = row.original.goal;
      if (!goal) {
        return <span className="text-xs text-muted-foreground">&mdash;</span>;
      }
      const display =
        goal.title.length > 20
          ? `${goal.title.slice(0, 20)}...`
          : goal.title;
      return <span className="text-sm">{display}</span>;
    },
  },
];
