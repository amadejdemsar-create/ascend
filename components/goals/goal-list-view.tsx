"use client";

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
import { columns, type GoalListItem } from "@/components/goals/goal-list-columns";
import { useUIStore } from "@/lib/stores/ui-store";

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
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: activeSorting },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(activeSorting) : updater;
      setActiveSorting(next);
    },
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
            <TableRow key={row.id} className="hover:bg-muted/50">
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
              No goals match your filters
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
