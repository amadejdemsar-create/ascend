"use client";

import { LinkIcon, DatabaseIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRelationBacklinks } from "@/lib/hooks/use-database-rows";

interface DatabaseRelationBacklinksProps {
  rowEntryId: string;
  onNavigate?: (entryId: string) => void;
}

/**
 * Panel showing incoming DATABASE_RELATION links to a row, grouped by
 * source database. Each row item is clickable to navigate to that entry.
 */
export function DatabaseRelationBacklinks({
  rowEntryId,
  onNavigate,
}: DatabaseRelationBacklinksProps) {
  const { data: groups, isLoading } = useRelationBacklinks(rowEntryId);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-48" />
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return null; // No backlinks; don't render anything
  }

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        <LinkIcon className="size-3" aria-hidden="true" />
        Linked from
      </div>

      {groups.map((group) => (
        <div key={group.fieldId} className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <DatabaseIcon className="size-3" aria-hidden="true" />
            <span className="font-medium">{group.databaseName}</span>
            <span className="text-muted-foreground/60">· {group.fieldName}</span>
          </div>

          <div className="pl-4 space-y-0.5">
            {group.rows.map((row) => (
              <button
                key={row.entryId}
                className="block text-xs text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1 py-0.5 -mx-1"
                onClick={() => onNavigate?.(row.entryId)}
                aria-label={`Navigate to ${row.title}`}
              >
                {row.title || "Untitled"}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
