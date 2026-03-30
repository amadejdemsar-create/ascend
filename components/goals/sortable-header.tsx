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
        <ArrowUp className="size-3.5 ml-1" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5 ml-1" />
      ) : (
        <ChevronsUpDown className="size-3.5 ml-1" />
      )}
    </Button>
  );
}
