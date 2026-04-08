"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { columns, type GoalListItem } from "@/components/goals/goal-list-columns";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

function SortableGoalRow({
  goalId,
  index,
  children,
}: {
  goalId: string;
  index: number;
  children: React.ReactNode;
}) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: goalId,
    index,
    type: "goal-row",
    accept: "goal-row",
  });

  return (
    <TableRow
      ref={ref}
      className={cn(
        "hover:bg-muted/50 transition-colors",
        isDragging && "opacity-30 bg-muted/30",
        isDropTarget && !isDragging && "bg-primary/5 border-t-2 border-t-primary"
      )}
    >
      <TableCell className="w-10 px-2">
        <span
          ref={handleRef}
          className={cn(
            "inline-flex text-muted-foreground hover:text-foreground",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <GripVertical className="size-4" />
        </span>
      </TableCell>
      {children}
    </TableRow>
  );
}

interface GoalListViewProps {
  goals: GoalListItem[];
}

export function GoalListView({ goals }: GoalListViewProps) {
  const activeSorting = useUIStore((s) => s.activeSorting);
  const setActiveSorting = useUIStore((s) => s.setActiveSorting);

  const table = useReactTable({
    data: goals,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { sorting: activeSorting },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(activeSorting) : updater;
      setActiveSorting(next);
    },
    enableSortingRemoval: true,
    manualSorting: true,
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            <TableHead className="w-10" />
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row, index) => (
            <SortableGoalRow key={row.id} goalId={row.original.id} index={index}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </SortableGoalRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length + 1}
              className="h-24 text-center text-muted-foreground"
            >
              No goals match your filters
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
