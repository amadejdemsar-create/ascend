"use client";

import { useMemo, useCallback } from "react";
import { ImageIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type {
  DatabaseResponse,
  DatabaseViewResponse,
  DatabaseFieldResponse,
} from "@/lib/hooks/use-databases";
import {
  useDatabaseRows,
  useCreateRow,
} from "@/lib/hooks/use-database-rows";
import { useUpdateView } from "@/lib/hooks/use-database-views";
import { GalleryCard } from "./gallery-card";
import { GalleryViewErrorBoundary } from "./gallery-view-error-boundary";

// ── Types ─────────────────────────────────────────────────────────────────

interface GalleryViewProps {
  database: DatabaseResponse;
  view: DatabaseViewResponse;
  onOpenRow: (rowEntryId: string) => void;
}

// ── Inner Component ──────────────────────────────────────────────────────

function GalleryViewInner({ database, view, onOpenRow }: GalleryViewProps) {
  // Parse view config.
  const viewConfig = useMemo(() => {
    const cfg = (view.config ?? {}) as {
      type?: string;
      coverFieldId?: string;
      visiblePropertyIds?: string[];
      filter?: Record<string, unknown>;
      sort?: Array<{ fieldId: string; direction: "asc" | "desc" }>;
    };
    return cfg;
  }, [view.config]);

  // Find the primary field.
  const primaryField = useMemo(
    () => database.fields.find((f) => f.isPrimary) ?? database.fields[0],
    [database.fields],
  );

  // Resolve cover field: only FILE and URL types are valid covers.
  const coverField = useMemo(() => {
    if (!viewConfig.coverFieldId) return null;
    const field = database.fields.find((f) => f.id === viewConfig.coverFieldId);
    if (!field) return null;
    if (field.type !== "FILE" && field.type !== "URL") return null;
    return field;
  }, [database.fields, viewConfig.coverFieldId]);

  // Fields eligible for cover selection (FILE and URL types only).
  const coverCandidateFields = useMemo(
    () => database.fields.filter((f) => f.type === "FILE" || f.type === "URL"),
    [database.fields],
  );

  // Visible property IDs: from config or default to next 2-3 non-primary,
  // non-formula fields (skip cover field if in range).
  const visiblePropertyIds = useMemo(() => {
    if (viewConfig.visiblePropertyIds?.length) {
      return viewConfig.visiblePropertyIds;
    }
    return database.fields
      .filter(
        (f) =>
          !f.isPrimary &&
          f.type !== "FORMULA" &&
          f.id !== coverField?.id,
      )
      .slice(0, 3)
      .map((f) => f.id);
  }, [database.fields, viewConfig.visiblePropertyIds, coverField]);

  // Fetch rows.
  const {
    data: rowsPage,
    isLoading,
    isError,
    refetch,
  } = useDatabaseRows(database.id, {
    viewId: view.id,
    sort: viewConfig.sort,
    filter: viewConfig.filter,
  });

  const rows = rowsPage?.rows ?? [];

  // Mutations.
  const createRow = useCreateRow(database.id);
  const updateView = useUpdateView(database.id);

  // ── Cover field config handlers ────────────────────────────────────────

  const handleSetCoverField = useCallback(
    (fieldId: string | null) => {
      const newConfig: Record<string, unknown> = {
        ...(view.config ?? {}),
        type: "GALLERY",
      };
      if (fieldId) {
        newConfig.coverFieldId = fieldId;
      } else {
        delete newConfig.coverFieldId;
      }

      updateView.mutate(
        { viewId: view.id, config: newConfig },
        { onError: (err) => toast.error(err.message) },
      );
    },
    [updateView, view.id, view.config],
  );

  // ── Add row handler ────────────────────────────────────────────────────

  const handleAddRow = useCallback(() => {
    createRow.mutate(
      { properties: {} },
      { onError: (err) => toast.error(err.message) },
    );
  }, [createRow]);

  // ── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-3 flex flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
        <p>Failed to load rows.</p>
        <button
          type="button"
          className="text-primary underline underline-offset-4 hover:text-primary/80"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
        <div className="flex flex-col items-center gap-2 text-center max-w-sm">
          <ImageIcon
            className="size-10 text-muted-foreground/40"
            aria-hidden="true"
          />
          <h3 className="text-sm font-medium text-foreground">No rows yet</h3>
          <p className="text-xs text-muted-foreground">
            Add a row to see it appear as a card in the gallery.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddRow}
          disabled={createRow.isPending}
          className="gap-1.5"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Add row
        </Button>
      </div>
    );
  }

  // ── Main gallery render ────────────────────────────────────────────────

  return (
    <div className="p-4">
      {/* Header: cover field config */}
      <div className="flex items-center gap-2 mb-4">
        <Popover>
          <PopoverTrigger
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Change cover field"
          >
            <ImageIcon className="size-3.5" aria-hidden="true" />
            Cover:{" "}
            {coverField ? coverField.name : "None"}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-1">
            <div className="flex flex-col">
              {/* No cover option */}
              <button
                type="button"
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors ${
                  !viewConfig.coverFieldId ? "bg-accent font-medium" : ""
                }`}
                onClick={() => handleSetCoverField(null)}
              >
                <XIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                No cover
              </button>

              {/* FILE and URL fields */}
              {coverCandidateFields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors ${
                    viewConfig.coverFieldId === f.id ? "bg-accent font-medium" : ""
                  }`}
                  onClick={() => handleSetCoverField(f.id)}
                >
                  <ImageIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {f.name}
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase">
                    {f.type}
                  </span>
                </button>
              ))}

              {coverCandidateFields.length === 0 && (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No FILE or URL fields available.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Card grid */}
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4"
        role="list"
        aria-label={`${database.name} gallery`}
      >
        {rows.map((row) => {
          const visibleProps = database.fields
            .filter(
              (f) =>
                visiblePropertyIds.includes(f.id) &&
                f.id !== primaryField.id &&
                f.type !== "FORMULA",
            )
            .slice(0, 3)
            .map((f) => ({ field: f, value: row.properties[f.id] }));

          return (
            <div key={row.id} role="listitem">
              <GalleryCard
                row={row}
                primaryFieldId={primaryField.id}
                primaryFieldName={primaryField.name}
                coverField={coverField}
                visibleProperties={visibleProps}
                onOpen={() => onOpenRow(row.entryId)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Exported with error boundary ──────────────────────────────────────────

/**
 * Database Gallery View.
 *
 * Responsive card grid where each card displays a configurable cover (FILE or
 * URL field) plus the primary field title and visible property values. Cover
 * field selection is configurable via a header dropdown that updates the view
 * config. Wrapped in an error boundary (DZ-7) to prevent page crashes.
 */
export function GalleryView(props: GalleryViewProps) {
  return (
    <GalleryViewErrorBoundary>
      <GalleryViewInner {...props} />
    </GalleryViewErrorBoundary>
  );
}
