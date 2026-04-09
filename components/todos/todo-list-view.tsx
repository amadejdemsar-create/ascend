"use client";

import { useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { columns, type TodoListItem, type TodoTableMeta } from "@/components/todos/todo-list-columns";
import { cn } from "@/lib/utils";

interface TodoListViewProps {
  todos: TodoListItem[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status !== "PENDING") return false;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

export function TodoListView({
  todos,
  onSelect,
  selectedId,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  allSelected,
}: TodoListViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const meta: TodoTableMeta = {
    isSelected: (id: string) => selectedIds.has(id),
    toggleRow: onToggleSelect,
    toggleAll: onToggleAll,
    allSelected,
  };

  const table = useReactTable({
    data: todos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: true,
    meta,
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
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
          table.getRowModel().rows.map((row) => {
            const overdue = isOverdue(
              row.original.dueDate,
              row.original.status,
            );
            return (
              <TableRow
                key={row.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedId === row.original.id && "bg-primary/5",
                  overdue && "bg-destructive/5 border-l-2 border-l-destructive",
                )}
                onClick={() => onSelect(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-muted-foreground"
            >
              No to-dos match your filters
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
