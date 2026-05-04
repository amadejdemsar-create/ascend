"use client";

import { useMemo } from "react";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";
import {
  useRelationSearch,
  useResolvedEntries,
} from "@/lib/hooks/use-relation-cell-helpers";
import { TableCell } from "./table-cell";

// ── Types ─────────────────────────────────────────────────────────────────

interface RelationCellWrapperProps {
  field: DatabaseFieldResponse;
  value: unknown;
  isPrimary: boolean;
  onOpenRow?: () => void;
  onUpdate: (newValue: unknown) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Wrapper around TableCell for RELATION-typed fields. Provides the required
 * `resolvedEntries` and `onSearch` props that the RelationEditor needs.
 *
 * Separated into its own component so hooks (useRelationSearch,
 * useResolvedEntries) can be called unconditionally at the top level.
 */
export function RelationCellWrapper({
  field,
  value,
  isPrimary,
  onOpenRow,
  onUpdate,
}: RelationCellWrapperProps) {
  const onSearch = useRelationSearch();

  // Extract entry IDs from the current value.
  const entryIds = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    return [];
  }, [value]);

  const resolvedEntries = useResolvedEntries(entryIds);

  const editorProps = useMemo(
    () => ({
      resolvedEntries,
      onSearch,
    }),
    [resolvedEntries, onSearch],
  );

  return (
    <TableCell
      field={field}
      value={value}
      isPrimary={isPrimary}
      onOpenRow={onOpenRow}
      onUpdate={onUpdate}
      editorProps={editorProps}
    />
  );
}
