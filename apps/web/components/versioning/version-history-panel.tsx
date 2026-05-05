"use client";

import { useState, useId, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDownIcon,
  DiffIcon,
  Undo2Icon,
  GitBranchPlusIcon,
  HistoryIcon,
  LoaderIcon,
} from "lucide-react";
import { useVersions } from "@/lib/hooks/use-versions";
import type { VersionListItem, VersionListResponse } from "@/lib/hooks/use-versions";
import { useUIStore } from "@/lib/stores/ui-store";
import type { NodeType } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { formatTrigger } from "./format-trigger";
import { VersionDiffModal } from "./version-diff-modal";
import { RestoreConfirmationDialog } from "./restore-confirmation-dialog";
import { BranchDialog } from "./branch-dialog";
import type { VersionTrigger } from "@/lib/validations";

/** Node types that support branching */
const BRANCHABLE_TYPES: Set<NodeType> = new Set(["CONTEXT_ENTRY", "DATABASE_ROW"]);

export interface VersionHistoryPanelProps {
  nodeType: NodeType;
  nodeId: string;
  /** Title of the entity (for branch dialog) */
  sourceTitle?: string;
  /** Database ID for DATABASE_ROW/DATABASE_FIELD (for restore cache invalidation) */
  databaseId?: string;
  /** Callback after a branch is created (e.g. navigate to new entry) */
  onBranched?: (newNodeId: string) => void;
  className?: string;
}

export function VersionHistoryPanel({
  nodeType,
  nodeId,
  sourceTitle = "Untitled",
  databaseId,
  onBranched,
  className,
}: VersionHistoryPanelProps) {
  const panelId = useId();
  const bodyId = `${panelId}-body`;
  const storeKey = `${nodeType}:${nodeId}`;

  const expanded = useUIStore((s) => s.versionHistoryExpanded[storeKey] ?? false);
  const setExpanded = useUIStore((s) => s.setVersionHistoryExpanded);

  const { data, isLoading } = useVersions(nodeType, nodeId, { limit: 20 });

  // Pagination: accumulate additional pages fetched via "Show older versions"
  const [extraPages, setExtraPages] = useState<VersionListResponse[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const initialVersions = data?.versions ?? [];
  const allVersions = [
    ...initialVersions,
    ...extraPages.flatMap((p) => p.versions),
  ];
  const lastCursor =
    extraPages.length > 0
      ? extraPages[extraPages.length - 1].nextCursor
      : data?.nextCursor ?? null;
  const hasMore = !!lastCursor;

  const loadOlderVersions = useCallback(async () => {
    if (!lastCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await apiFetch<VersionListResponse>(
        `/api/versions/${nodeType}/${nodeId}?limit=20&cursor=${lastCursor}`,
      );
      setExtraPages((prev) => [...prev, next]);
    } finally {
      setLoadingMore(false);
    }
  }, [lastCursor, loadingMore, nodeType, nodeId]);

  // State for sub-dialogs
  const [diffModal, setDiffModal] = useState<{ toVersionId: string } | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<VersionListItem | null>(null);
  const [branchDialog, setBranchDialog] = useState<VersionListItem | null>(null);

  const isBranchable = BRANCHABLE_TYPES.has(nodeType);
  const count = allVersions.length + (hasMore ? "+" : "");

  function handleToggle() {
    setExpanded(storeKey, !expanded);
  }

  return (
    <div className={cn("space-y-1", className)}>
      {/* Header toggle */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={expanded}
        aria-controls={bodyId}
      >
        <HistoryIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">
          {isLoading ? "Version history" : `${count} version${allVersions.length === 1 ? "" : "s"}`}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {/* Body */}
      {expanded && (
        <div id={bodyId} className="pl-2">
          {isLoading && (
            <div className="space-y-2 py-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          )}

          {!isLoading && allVersions.length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">
              No version history yet.
            </p>
          )}

          {!isLoading && allVersions.length > 0 && (
            <ul className="space-y-1 py-1" role="list" aria-label="Version history">
              {allVersions.map((v) => {
                const triggerDisplay = formatTrigger(v.trigger as VersionTrigger);
                const timeAgo = formatDistanceToNow(new Date(v.createdAt), {
                  addSuffix: true,
                });

                return (
                  <li
                    key={v.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs group hover:bg-muted/40"
                  >
                    {/* Timestamp and trigger */}
                    <span className="flex-1 min-w-0">
                      <span className="text-muted-foreground">{timeAgo}</span>
                      <Badge
                        variant={
                          triggerDisplay.tone === "info"
                            ? "secondary"
                            : triggerDisplay.tone === "warning"
                              ? "outline"
                              : "secondary"
                        }
                        className="ml-1.5 text-[0.6rem] px-1 py-0"
                      >
                        {triggerDisplay.label}
                      </Badge>
                    </span>

                    {/* Action buttons */}
                    <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDiffModal({ toVersionId: v.id })}
                        title="View diff vs current"
                        aria-label={`View diff for version ${v.versionNumber}`}
                        className="size-6"
                      >
                        <DiffIcon className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRestoreDialog(v)}
                        title="Restore this version"
                        aria-label={`Restore version ${v.versionNumber}`}
                        className="size-6"
                      >
                        <Undo2Icon className="size-3" />
                      </Button>
                      {isBranchable && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setBranchDialog(v)}
                          title="Branch from this version"
                          aria-label={`Branch from version ${v.versionNumber}`}
                          className="size-6"
                        >
                          <GitBranchPlusIcon className="size-3" />
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Load older versions when more exist */}
          {!isLoading && hasMore && (
            <div className="px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadOlderVersions}
                disabled={loadingMore}
                className="h-7 w-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                {loadingMore && (
                  <LoaderIcon className="size-3 animate-spin" aria-hidden="true" />
                )}
                {loadingMore ? "Loading..." : "Show older versions"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Diff modal */}
      {diffModal && (
        <VersionDiffModal
          open={!!diffModal}
          onClose={() => setDiffModal(null)}
          nodeType={nodeType}
          nodeId={nodeId}
          fromVersionId={null}
          toVersionId={diffModal.toVersionId}
          sourceTitle={sourceTitle}
          derivativeCount={0}
          onBranched={onBranched}
          databaseId={databaseId}
        />
      )}

      {/* Restore dialog */}
      {restoreDialog && (
        <RestoreConfirmationDialog
          open={!!restoreDialog}
          onClose={() => setRestoreDialog(null)}
          versionId={restoreDialog.id}
          nodeType={nodeType}
          nodeId={nodeId}
          databaseId={databaseId}
          versionLabel={`version ${restoreDialog.versionNumber} (${formatDistanceToNow(new Date(restoreDialog.createdAt), { addSuffix: true })})`}
        />
      )}

      {/* Branch dialog */}
      {branchDialog && isBranchable && (
        <BranchDialog
          open={!!branchDialog}
          onClose={() => setBranchDialog(null)}
          versionId={branchDialog.id}
          nodeType={nodeType}
          nodeId={nodeId}
          sourceTitle={sourceTitle}
          derivativeCount={0}
          onBranched={onBranched}
        />
      )}
    </div>
  );
}
