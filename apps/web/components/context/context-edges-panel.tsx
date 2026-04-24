"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Link2, Plus } from "lucide-react";
import {
  CONTEXT_LINK_TYPE_VALUES,
  type ContextLinkType,
  type ContextEntryType,
} from "@ascend/core";
import { edgeColor } from "@ascend/graph";
import {
  useContextEntry,
  useUpdateContextLink,
  useDeleteContextLink,
} from "@/lib/hooks/use-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ContextQuickLinkDialog } from "@/components/context/context-quick-link-dialog";

// ── Label maps ────────────────────────────────────────────────────

const LINK_TYPE_LABELS: Record<ContextLinkType, string> = {
  REFERENCES: "References",
  EXTENDS: "Extends",
  CONTRADICTS: "Contradicts",
  SUPPORTS: "Supports",
  EXAMPLE_OF: "Example of",
  DERIVED_FROM: "Derived from",
  SUPERSEDES: "Supersedes",
  APPLIES_TO: "Applies to",
  PART_OF: "Part of",
};

export { LINK_TYPE_LABELS };

// ── Types ─────────────────────────────────────────────────────────

interface RawLink {
  id: string;
  fromEntryId: string;
  toEntryId: string;
  type: ContextLinkType;
  source: "CONTENT" | "MANUAL";
  fromEntry?: { id: string; title: string; type: ContextEntryType };
  toEntry?: { id: string; title: string; type: ContextEntryType };
}

// ── Sub-components ────────────────────────────────────────────────

interface LinkRowProps {
  link: RawLink;
  /** The entry title to display (target for outgoing, source for incoming). */
  displayTitle: string;
  /** The id to navigate to when clicking the title. */
  navigateToId: string;
  direction: "outgoing" | "incoming";
}

function LinkRow({ link, displayTitle, navigateToId, direction }: LinkRowProps) {
  const updateLink = useUpdateContextLink();
  const deleteLink = useDeleteContextLink();
  const isContent = link.source === "CONTENT";

  function handleTypeChange(newType: ContextLinkType) {
    if (newType === link.type) return;
    updateLink.mutate(
      {
        id: link.id,
        fromEntryId: link.fromEntryId,
        toEntryId: link.toEntryId,
        data: { type: newType },
      },
      {
        onSuccess: () => {
          toast.success("Link type updated");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to update link",
          );
        },
      },
    );
  }

  function handleDelete() {
    deleteLink.mutate(
      {
        id: link.id,
        fromEntryId: link.fromEntryId,
        toEntryId: link.toEntryId,
      },
      {
        onSuccess: () => {
          toast.success("Link removed");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to remove link",
          );
        },
      },
    );
  }

  function handleNavigate() {
    window.dispatchEvent(
      new CustomEvent("ascend:context-node-select", {
        detail: { id: navigateToId },
      }),
    );
  }

  return (
    <div className="flex items-center gap-1.5 py-1">
      {/* Title (clickable) */}
      <button
        type="button"
        onClick={handleNavigate}
        className="flex items-center gap-1 text-sm text-primary hover:underline min-w-0 text-left truncate flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        title={displayTitle}
      >
        <Link2 className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{displayTitle}</span>
      </button>

      {/* Type selector */}
      <Select
        value={link.type}
        onValueChange={(val) => handleTypeChange(val as ContextLinkType)}
        disabled={updateLink.isPending}
      >
        <SelectTrigger
          size="sm"
          aria-label={`Link type for ${displayTitle} (${direction})`}
          className="text-[0.65rem] h-6 px-1.5 gap-1 max-w-[100px]"
        >
          <SelectValue>
            <span
              className="inline-block size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: edgeColor(link.type) }}
              aria-hidden="true"
            />
            <span className="truncate">{LINK_TYPE_LABELS[link.type]}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {CONTEXT_LINK_TYPE_VALUES.map((lt) => (
            <SelectItem key={lt} value={lt}>
              <span
                className="inline-block size-2 rounded-full shrink-0"
                style={{ backgroundColor: edgeColor(lt) }}
                aria-hidden="true"
              />
              <span>{LINK_TYPE_LABELS[lt]}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Delete button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 size-6"
                disabled={isContent || deleteLink.isPending}
                onClick={isContent ? undefined : handleDelete}
                aria-label={
                  isContent
                    ? "Content-derived link cannot be deleted"
                    : `Remove link to ${displayTitle}`
                }
              />
            }
          >
            <Trash2
              className={`size-3 ${isContent ? "text-muted-foreground/40" : "text-destructive"}`}
              aria-hidden="true"
            />
          </TooltipTrigger>
          {isContent && (
            <TooltipContent>
              Content-derived link. Edit entry content to remove the wikilink.
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

interface ContextEdgesPanelProps {
  entryId: string;
}

export function ContextEdgesPanel({ entryId }: ContextEdgesPanelProps) {
  const { data: entryRaw, isLoading, isError } = useContextEntry(entryId);
  const [quickLinkOpen, setQuickLinkOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = entryRaw as Record<string, any> | undefined;

  const outgoingLinks = (entry?.outgoingLinks ?? []) as RawLink[];
  const incomingLinks = (entry?.incomingLinks ?? []) as RawLink[];

  // Group links by type
  const outgoingGrouped = useMemo(() => {
    const map = new Map<ContextLinkType, RawLink[]>();
    for (const link of outgoingLinks) {
      const group = map.get(link.type) ?? [];
      group.push(link);
      map.set(link.type, group);
    }
    return map;
  }, [outgoingLinks]);

  const incomingGrouped = useMemo(() => {
    const map = new Map<ContextLinkType, RawLink[]>();
    for (const link of incomingLinks) {
      const group = map.get(link.type) ?? [];
      group.push(link);
      map.set(link.type, group);
    }
    return map;
  }, [incomingLinks]);

  const hasLinks = outgoingLinks.length > 0 || incomingLinks.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (isError || !entry) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Section header with quick link button */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Connections
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-xs"
          onClick={() => setQuickLinkOpen(true)}
          aria-label="Add a manual link"
        >
          <Plus className="size-3" aria-hidden="true" />
          Quick link
        </Button>
      </div>

      {!hasLinks && (
        <p className="text-xs text-muted-foreground">
          No connected entries yet. Add a manual link with Quick link or write a
          [[wikilink]] in this entry.
        </p>
      )}

      {/* Outgoing links */}
      {outgoingGrouped.size > 0 && (
        <div className="space-y-2">
          <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
            Outgoing
          </span>
          {Array.from(outgoingGrouped.entries()).map(([type, links]) => (
            <div key={type} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: edgeColor(type) }}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {LINK_TYPE_LABELS[type]}
                </span>
                <span className="text-[0.6rem] text-muted-foreground/70">
                  {links.length}
                </span>
              </div>
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  displayTitle={link.toEntry?.title ?? "Unknown"}
                  navigateToId={link.toEntry?.id ?? link.toEntryId}
                  direction="outgoing"
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Separator between outgoing and incoming when both exist */}
      {outgoingGrouped.size > 0 && incomingGrouped.size > 0 && (
        <Separator />
      )}

      {/* Incoming links */}
      {incomingGrouped.size > 0 && (
        <div className="space-y-2">
          <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
            Incoming
          </span>
          {Array.from(incomingGrouped.entries()).map(([type, links]) => (
            <div key={type} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: edgeColor(type) }}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {LINK_TYPE_LABELS[type]}
                </span>
                <span className="text-[0.6rem] text-muted-foreground/70">
                  {links.length}
                </span>
              </div>
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  displayTitle={link.fromEntry?.title ?? "Unknown"}
                  navigateToId={link.fromEntry?.id ?? link.fromEntryId}
                  direction="incoming"
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Quick link dialog */}
      <ContextQuickLinkDialog
        fromEntryId={entryId}
        open={quickLinkOpen}
        onOpenChange={setQuickLinkOpen}
      />
    </div>
  );
}
