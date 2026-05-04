"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDatabaseByEntry, useUpdateDatabase } from "@/lib/hooks/use-databases";
import { DatabaseViewSwitcher } from "./database-view-switcher";
import { TableView } from "./table-view";
import { BoardView } from "./board-view";
import { DatabaseCalendarView } from "./calendar-view";
import { GalleryView } from "./gallery-view";
import { DatabaseTimelineView } from "./timeline-view";
import type { DatabaseResponse, DatabaseViewResponse } from "@/lib/hooks/use-databases";

interface DatabaseDetailProps {
  entryId: string;
  onOpenRow: (rowEntryId: string) => void;
}

/**
 * Top-level component rendered when an entry of type DATABASE is opened
 * in the right panel. Shows the database name, view tab strip, and the
 * active view renderer (Table, Board, Calendar, Gallery, or Timeline).
 */
export function DatabaseDetail({ entryId, onOpenRow }: DatabaseDetailProps) {
  const { data: database, isLoading } = useDatabaseByEntry(entryId);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Determine the active view
  const resolvedViewId =
    activeViewId ?? database?.defaultViewId ?? database?.views?.[0]?.id ?? null;
  const activeView = database?.views?.find(
    (v: DatabaseViewResponse) => v.id === resolvedViewId,
  ) ?? null;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!database) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Database not found.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header with inline-editable name */}
      <DatabaseNameHeader database={database} />

      {/* View tab strip */}
      <DatabaseViewSwitcher
        views={database.views}
        activeViewId={resolvedViewId}
        onSelectView={setActiveViewId}
        databaseId={database.id}
      />

      {/* Active view renderer with fade+slide transition */}
      <div className="flex-1 overflow-auto">
        {activeView ? (
          <div
            key={activeView.id}
            className="h-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none"
          >
            <ActiveViewRenderer
              database={database}
              view={activeView}
              onOpenRow={onOpenRow}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
            No views available. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline-editable database name ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = Record<string, any>;

function getDatabaseName(database: DatabaseResponse): string {
  // The API returns the database with contextEntry.title as the name.
  // The hook type says `name: string` but the actual response may differ.
  const db = database as AnyDatabase;
  if (db.name && typeof db.name === "string") return db.name;
  if (db.contextEntry?.title) return db.contextEntry.title;
  return "Untitled";
}

function DatabaseNameHeader({ database }: { database: DatabaseResponse }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const updateDatabase = useUpdateDatabase(database.id);
  const displayName = getDatabaseName(database);

  const handleStartEdit = useCallback(() => {
    setEditValue(displayName);
    setIsEditing(true);
  }, [displayName]);

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === displayName) {
      setIsEditing(false);
      return;
    }
    try {
      await updateDatabase.mutateAsync({ name: trimmed });
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    }
  }, [editValue, displayName, updateDatabase]);

  return (
    <div className="px-4 pt-4 pb-2">
      {isEditing ? (
        <input
          autoFocus
          className="w-full text-lg font-serif font-semibold bg-transparent border-b border-primary/40 outline-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
          aria-label="Database name"
        />
      ) : (
        <h2
          className="text-lg font-serif font-semibold leading-tight cursor-pointer hover:text-primary/80 transition-colors"
          onClick={handleStartEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleStartEdit();
          }}
          aria-label={`Database name: ${displayName}. Click to edit.`}
        >
          {displayName}
        </h2>
      )}
    </div>
  );
}

// ── Active view renderer ──────────────────────────────────────────────

function ActiveViewRenderer({
  database,
  view,
  onOpenRow,
}: {
  database: DatabaseResponse;
  view: DatabaseViewResponse;
  onOpenRow: (rowEntryId: string) => void;
}) {
  const viewType = view.type as string;

  switch (viewType) {
    case "TABLE":
      return <TableView database={database} view={view} onOpenRow={onOpenRow} />;
    case "BOARD":
      return <BoardView database={database} view={view} onOpenRow={onOpenRow} />;
    case "CALENDAR":
      return <DatabaseCalendarView database={database} view={view} onOpenRow={onOpenRow} />;
    case "GALLERY":
      return <GalleryView database={database} view={view} onOpenRow={onOpenRow} />;
    case "TIMELINE":
      return <DatabaseTimelineView database={database} view={view} onOpenRow={onOpenRow} />;
    default:
      return (
        <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
          Unknown view type: {viewType}
        </div>
      );
  }
}
