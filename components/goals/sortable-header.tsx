"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SortableHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function SortableHeader<TData, TValue>({
  column,
  title,
}: SortableHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="ml-1 size-4 text-foreground" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-1 size-4 text-foreground" />
      ) : (
        <ChevronsUpDown className="ml-1 size-3.5 opacity-50" />
      )}
    </Button>
  );
}
