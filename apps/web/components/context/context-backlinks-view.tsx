"use client";

import { useMemo, useState } from "react";
import { Link2, ChevronRight, ArrowDownWideNarrow } from "lucide-react";
import { nodeColor } from "@ascend/graph";
import type { ContextEntryType } from "@ascend/core";
import {
  useContextGraph,
  useContextEntry,
  type ContextGraphNode,
} from "@/lib/hooks/use-context";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_ICONS,
} from "@/components/context/context-type-select";

// ── Backlink row with expandable references ───────────────────────

interface BacklinkRowProps {
  node: ContextGraphNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function BacklinkRow({ node, isSelected, onSelect }: BacklinkRowProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ENTRY_TYPE_ICONS[node.type] ?? ENTRY_TYPE_ICONS.NOTE;
  const color = nodeColor(node.type);

  function handleClick() {
    // Dispatch the same custom event used by the graph view so the page
    // opens the detail panel for this entry.
    window.dispatchEvent(
      new CustomEvent("ascend:context-node-select", {
        detail: { id: node.id },
      }),
    );
    onSelect(node.id);
  }

  function handleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }

  function handleExpandKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      setExpanded((prev) => !prev);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-2 w-full rounded-lg border p-3 text-left transition-colors",
          isSelected
            ? "border-primary/30 bg-primary/5"
            : "border-transparent hover:border-border hover:bg-muted/40",
        )}
      >
        {/* Type icon */}
        <div
          className="flex size-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="size-3.5" style={{ color }} aria-hidden="true" />
        </div>

        {/* Title */}
        <span className="text-sm font-medium truncate flex-1">
          {node.title}
        </span>

        {/* Type pill */}
        <Badge
          variant="secondary"
          className="text-[0.6rem] px-1.5 py-0 shrink-0"
          style={{ borderColor: `${color}40` }}
        >
          {ENTRY_TYPE_LABELS[node.type]}
        </Badge>

        {/* Incoming count badge */}
        <div className="flex items-center gap-1 shrink-0">
          <Link2 className="size-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">
            {node.incomingCount}
          </span>
        </div>

        {/* Expand toggle */}
        {node.incomingCount > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleExpand}
            onKeyDown={handleExpandKeyDown}
            className={cn(
              "p-0.5 rounded transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              expanded && "rotate-90",
            )}
            aria-label={expanded ? "Collapse references" : "Expand references"}
            aria-expanded={expanded}
          >
            <ChevronRight
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        )}
      </button>

      {/* Expandable "Referenced by" section */}
      {expanded && node.incomingCount > 0 && (
        <ReferencedByList entryId={node.id} onNavigate={onSelect} />
      )}
    </div>
  );
}

// ── Referenced-by list (lazy-loaded per entry on expand) ──────────

interface ReferencedByListProps {
  entryId: string;
  onNavigate: (id: string) => void;
}

function ReferencedByList({ entryId, onNavigate }: ReferencedByListProps) {
  const { data: entryRaw, isLoading } = useContextEntry(entryId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = entryRaw as Record<string, any> | undefined;

  const incomingLinks = useMemo(() => {
    if (!entry?.incomingLinks) return [];
    return (
      entry.incomingLinks as Array<{
        id: string;
        fromEntry?: { id: string; title: string; type: ContextEntryType };
      }>
    )
      .filter((l) => l.fromEntry)
      .map((l) => ({
        id: l.fromEntry!.id,
        title: l.fromEntry!.title,
        type: l.fromEntry!.type,
      }));
  }, [entry?.incomingLinks]);

  if (isLoading) {
    return (
      <div className="pl-10 space-y-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  if (incomingLinks.length === 0) {
    return null;
  }

  return (
    <div className="pl-10 space-y-0.5" role="list" aria-label="Referenced by">
      <span className="text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground">
        Referenced by
      </span>
      {incomingLinks.map((ref) => {
        const RefIcon = ENTRY_TYPE_ICONS[ref.type] ?? ENTRY_TYPE_ICONS.NOTE;
        const refColor = nodeColor(ref.type);
        return (
          <button
            key={ref.id}
            type="button"
            role="listitem"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("ascend:context-node-select", {
                  detail: { id: ref.id },
                }),
              );
              onNavigate(ref.id);
            }}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline w-full text-left py-0.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <RefIcon
              className="size-3 shrink-0"
              style={{ color: refColor }}
              aria-hidden="true"
            />
            <span className="truncate">{ref.title}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main backlinks view ───────────────────────────────────────────

interface ContextBacklinksViewProps {
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

export function ContextBacklinksView({
  selectedId,
  onSelect,
}: ContextBacklinksViewProps) {
  const { data: graphData, isLoading } = useContextGraph();

  // Sort nodes by incoming link count descending
  const sortedNodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    return [...graphData.nodes].sort(
      (a, b) => b.incomingCount - a.incomingCount,
    );
  }, [graphData?.nodes]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (sortedNodes.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={ArrowDownWideNarrow}
          title="No backlinks yet"
          description="Backlinks appear when entries reference each other via wikilinks or manual links."
        />
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {sortedNodes.map((node) => (
        <BacklinkRow
          key={node.id}
          node={node}
          isSelected={selectedId === node.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
