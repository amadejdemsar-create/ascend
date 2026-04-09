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
import { columns, type TodoListItem } from "@/components/todos/todo-list-columns";
import { cn } from "@/lib/utils";

interface TodoListViewProps {
  todos: TodoListItem[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export function TodoListView({ todos, onSelect, selectedId }: TodoListViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: todos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: true,
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
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                "cursor-pointer hover:bg-muted/50 transition-colors",
                selectedId === row.original.id && "bg-primary/5",
              )}
              onClick={() => onSelect(row.original.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
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
