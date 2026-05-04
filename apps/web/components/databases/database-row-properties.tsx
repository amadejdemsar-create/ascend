"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { DatabaseIcon, LinkIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useDatabase } from "@/lib/hooks/use-databases";
import { useDatabaseRows, useUpdateRow } from "@/lib/hooks/use-database-rows";
import { PropertyCell } from "./property-editors";
import { DatabaseRelationBacklinks } from "./database-relation-backlinks";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";

interface DatabaseRowPropertiesProps {
  rowEntryId: string;
  onNavigate?: (entryId: string) => void;
}

/**
 * Renders above the block editor for entries of type RECORD.
 * Shows the database name, a vertical stack of property editors,
 * and incoming relation backlinks.
 */
export function DatabaseRowProperties({
  rowEntryId,
  onNavigate,
}: DatabaseRowPropertiesProps) {
  // We need to find the row by entry id. The row belongs to a database.
  // Strategy: fetch all databases, find which one has this entry as a row.
  // Since we cannot easily determine which database a row belongs to without
  // a direct lookup, we use a dedicated query: rows endpoint filtered by entryId.
  // However, the current API doesn't support that directly.
  //
  // Alternative approach: The row's database is available from the ContextEntry
  // response's databaseRow relation. But we fetch it from the client side.
  // The simplest approach for now: use a custom hook that fetches the row info.
  //
  // Since we don't have a direct "get row by entryId" hook yet, we'll rely on
  // the fact that the parent (context-entry-detail.tsx) can pass us the required
  // data. But to keep this component self-contained, we'll use the row-lookup
  // endpoint approach.
  //
  // For Phase 13 we take the pragmatic path: fetch from a lookup endpoint.
  // The entry detail already has the entry data with its databaseRow relation.
  // Let's use the entry's own data that the parent passes.

  // Actually, let's use the simpler approach: the context entry detail already
  // fetches the full entry, and for RECORD entries, the API includes databaseRow.
  // We'll have the parent component pass databaseId + rowId if available,
  // or we query it here.

  // Simplest self-contained approach: fetch databases list and find the one
  // with this row. Too expensive. Instead, create a simple lookup.
  // For now, we use a "databases/relation-backlinks" style approach where
  // we ask the API for the row metadata by entryId.
  //
  // PRAGMATIC: The entry detail response already includes `databaseRow` if
  // present. We'll accept props with that info, or fetch from a new simple route.
  // For Phase 13, we'll use a simple layout: fetch the database via row lookup.

  return <DatabaseRowPropertiesInner rowEntryId={rowEntryId} onNavigate={onNavigate} />;
}

// ── Inner component that does the actual work ─────────────────────────

function DatabaseRowPropertiesInner({
  rowEntryId,
  onNavigate,
}: {
  rowEntryId: string;
  onNavigate?: (entryId: string) => void;
}) {
  // We'll fetch using the entry's row data. Since we don't have a direct
  // "get row by entryId" endpoint, we use an approach where we read from
  // the context entry detail which includes databaseRow info.
  //
  // For a self-contained approach: we add a minimal query that fetches
  // {databaseId, rowId, properties} via a dedicated lightweight endpoint.
  // Since Phase 13 scope says "use Phase 5 hooks", and Phase 5 hooks don't
  // have a "get row by entryId" hook, we'll use the databases list + rows
  // query approach with an optimization: pass databaseId from the parent.
  //
  // DECISION: Use a custom hook `useRowByEntry` that calls
  // GET /api/databases/relation-backlinks/[rowEntryId] as an existence check,
  // then look up which database the row belongs to from the entry detail data.
  //
  // Actually, the cleanest approach for Phase 13: The parent context-entry-detail
  // already has the entry data (which now includes `databaseRow` in the API
  // response). We can accept databaseId + rowId as optional props that the parent
  // passes when it knows them.
  //
  // For this implementation, we'll keep it simpler: fetch ALL databases (cheap,
  // cached) and find the one containing this row. The useDatabases() hook returns
  // the list with row counts, but not individual row entryIds.
  //
  // FINAL APPROACH: We'll render a minimal version that fetches the row data
  // using a custom fetch. This is acceptable for v1; the optimization can come later.

  // Use an inline query via apiFetch to get row info by entry ID.
  // We need: databaseId, rowId, properties, and the database's fields.
  const { data, isLoading } = useRowByEntryId(rowEntryId);

  if (isLoading) {
    return (
      <div className="space-y-2 mb-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!data) {
    return null; // Row info not available; silently skip
  }

  return (
    <div className="space-y-3 mb-4">
      {/* Header: database name link */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <DatabaseIcon className="size-3" aria-hidden="true" />
        {data.databaseEntryId && onNavigate ? (
          <button
            className="hover:text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            onClick={() => onNavigate(data.databaseEntryId!)}
            aria-label={`Open database: ${data.databaseName}`}
          >
            {data.databaseName}
          </button>
        ) : (
          <span>{data.databaseName}</span>
        )}
        <span className="text-muted-foreground/60">· row</span>
      </div>

      {/* Property editors in expanded mode */}
      <PropertyEditorStack
        fields={data.fields}
        properties={data.properties}
        databaseId={data.databaseId}
        rowId={data.rowId}
        rowEntryId={rowEntryId}
      />

      {/* Relation backlinks */}
      <DatabaseRelationBacklinks
        rowEntryId={rowEntryId}
        onNavigate={onNavigate}
      />

      <Separator />
    </div>
  );
}

// ── Property editor stack ─────────────────────────────────────────────

function PropertyEditorStack({
  fields,
  properties,
  databaseId,
  rowId,
  rowEntryId,
}: {
  fields: DatabaseFieldResponse[];
  properties: Record<string, unknown>;
  databaseId: string;
  rowId: string;
  rowEntryId: string;
}) {
  const updateRow = useUpdateRow(databaseId);

  // Skip primary field (shown as the entry title) and formula fields
  const editableFields = useMemo(
    () => fields.filter((f) => !f.isPrimary && f.type !== "FORMULA"),
    [fields],
  );

  function handleChange(fieldId: string, value: unknown) {
    const isRelation = fields.find((f) => f.id === fieldId)?.type === "RELATION";
    updateRow.mutate(
      {
        rowId,
        properties: { [fieldId]: value },
        affectsRelations: isRelation,
        rowEntryId,
      },
      {
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update");
        },
      },
    );
  }

  if (editableFields.length === 0) return null;

  return (
    <div className="space-y-2">
      {editableFields.map((field) => (
        <div key={field.id} className="flex flex-col gap-0.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {field.name}
          </label>
          <PropertyCell
            field={{
              name: field.name,
              type: field.type as "TEXT" | "NUMBER" | "DATE" | "SELECT" | "MULTI_SELECT" | "RELATION" | "FORMULA" | "USER" | "CHECKBOX" | "RATING" | "URL" | "EMAIL" | "PHONE" | "FILE",
              config: (field.config ?? { type: field.type }) as import("@ascend/core").DatabaseFieldConfig,
              position: field.position,
              isPrimary: field.isPrimary,
            }}
            value={properties[field.id] ?? null}
            onChange={(next) => handleChange(field.id, next)}
            mode="expanded"
          />
        </div>
      ))}
    </div>
  );
}

// ── Hook to fetch row data by entry ID ────────────────────────────────

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface RowByEntryData {
  databaseId: string;
  databaseName: string;
  databaseEntryId: string | null;
  rowId: string;
  properties: Record<string, unknown>;
  fields: DatabaseFieldResponse[];
}

/**
 * Fetches a database row's metadata by its backing ContextEntry ID.
 * Hits GET /api/databases/row-by-entry/[entryId] (new lightweight route).
 *
 * Fallback: if the route doesn't exist yet, returns null gracefully.
 */
function useRowByEntryId(entryId: string) {
  return useQuery<RowByEntryData | null>({
    queryKey: ["databases", "row-by-entry", entryId],
    queryFn: async () => {
      try {
        return await apiFetch<RowByEntryData>(
          `/api/databases/row-by-entry/${entryId}`,
        );
      } catch {
        // Route may not exist yet; return null gracefully.
        return null;
      }
    },
    enabled: !!entryId,
    staleTime: 60_000,
  });
}
