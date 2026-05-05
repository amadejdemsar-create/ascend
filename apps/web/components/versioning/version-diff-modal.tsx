"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Undo2Icon, GitBranchPlusIcon } from "lucide-react";
import { useDiff, useVersion } from "@/lib/hooks/use-versions";
import type { VersionDetailResponse } from "@/lib/hooks/use-versions";
import type { NodeType, VersionTrigger } from "@/lib/validations";
import type { DiffResult } from "@ascend/diff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BlockDiffRenderer } from "./diff-renderers/block-diff-renderer";
import { FieldDiffRenderer } from "./diff-renderers/field-diff-renderer";
import { PropertyDiffRenderer } from "./diff-renderers/property-diff-renderer";
import { FieldConfigDiffRenderer } from "./diff-renderers/field-config-diff-renderer";
import { RestoreConfirmationDialog } from "./restore-confirmation-dialog";
import { BranchDialog } from "./branch-dialog";
import { formatTrigger } from "./format-trigger";

export interface VersionDiffModalProps {
  open: boolean;
  onClose: () => void;
  nodeType: NodeType;
  nodeId: string;
  fromVersionId: string | null;
  toVersionId: string;
  /** Title of the source node (for the branch dialog) */
  sourceTitle?: string;
  /** Number of existing derivatives (for the branch soft-warning) */
  derivativeCount?: number;
  /** Callback when a branch is created */
  onBranched?: (newNodeId: string) => void;
  /** Database ID for DATABASE_ROW/DATABASE_FIELD (for restore cache invalidation) */
  databaseId?: string;
}

/** Whether branching is supported for a given nodeType */
const BRANCHABLE_TYPES: Set<NodeType> = new Set(["CONTEXT_ENTRY", "DATABASE_ROW"]);

function DiffRenderer({ diff }: { diff: DiffResult }) {
  switch (diff.kind) {
    case "block-diff":
      return <BlockDiffRenderer diff={diff} />;
    case "field-diff":
      return <FieldDiffRenderer diff={diff} />;
    case "property-diff":
      return <PropertyDiffRenderer diff={diff} />;
    case "field-config-diff":
      return <FieldConfigDiffRenderer diff={diff} />;
  }
}

// ---------------------------------------------------------------------------
// Payload preview for the narrow-viewport Older / Newer tabs
// ---------------------------------------------------------------------------

/** Extract a text preview from a block document snapshot (walk root.children). */
function extractBlockText(snapshot: unknown, maxLen = 500): string {
  if (!snapshot || typeof snapshot !== "object") return "";
  const root = (snapshot as Record<string, unknown>).root;
  if (!root || typeof root !== "object") return "";
  const children = (root as Record<string, unknown>).children;
  if (!Array.isArray(children)) return "";

  const parts: string[] = [];
  function walk(nodes: unknown[]) {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (typeof n.text === "string" && n.text.length > 0) {
        parts.push(n.text);
        if (parts.join(" ").length >= maxLen) return;
      }
      if (Array.isArray(n.children)) {
        walk(n.children);
        if (parts.join(" ").length >= maxLen) return;
      }
    }
  }
  walk(children);
  const full = parts.join(" ");
  return full.length > maxLen ? full.slice(0, maxLen) + "..." : full;
}

/** Render a compact read-only preview based on the version's nodeType. */
function VersionPayloadPreview({
  version,
  nodeType,
}: {
  version: VersionDetailResponse;
  nodeType: NodeType;
}) {
  const payload = version.payload as Record<string, unknown>;

  if (nodeType === "CONTEXT_ENTRY") {
    const blockPreview = extractBlockText(payload.blockDocumentSnapshot);
    if (blockPreview) {
      return (
        <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-6">
          {blockPreview}
        </p>
      );
    }
    // Fallback to title + type summary
    const title = typeof payload.title === "string" ? payload.title : "";
    const type = typeof payload.type === "string" ? payload.type : "";
    return (
      <dl className="text-xs text-muted-foreground mt-2 space-y-1">
        {title && (
          <div>
            <dt className="inline font-medium">Title: </dt>
            <dd className="inline">{title}</dd>
          </div>
        )}
        {type && (
          <div>
            <dt className="inline font-medium">Type: </dt>
            <dd className="inline">{type}</dd>
          </div>
        )}
      </dl>
    );
  }

  if (nodeType === "GOAL" || nodeType === "TODO") {
    const title = typeof payload.title === "string" ? payload.title : "";
    const description = typeof payload.description === "string" ? payload.description : "";
    const status = typeof payload.status === "string" ? payload.status : "";
    const priority = typeof payload.priority === "string" ? payload.priority : "";
    return (
      <dl className="text-xs text-muted-foreground mt-2 space-y-1">
        {title && (
          <div>
            <dt className="inline font-medium">Title: </dt>
            <dd className="inline">{title}</dd>
          </div>
        )}
        {status && (
          <div>
            <dt className="inline font-medium">Status: </dt>
            <dd className="inline">{status}</dd>
          </div>
        )}
        {priority && (
          <div>
            <dt className="inline font-medium">Priority: </dt>
            <dd className="inline">{priority}</dd>
          </div>
        )}
        {description && (
          <div>
            <dt className="inline font-medium">Description: </dt>
            <dd className="inline line-clamp-3">{description.slice(0, 200)}{description.length > 200 ? "..." : ""}</dd>
          </div>
        )}
      </dl>
    );
  }

  if (nodeType === "DATABASE_ROW") {
    const properties = payload.properties;
    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
      const entries = Object.entries(properties as Record<string, unknown>).slice(0, 8);
      return (
        <dl className="text-xs text-muted-foreground mt-2 space-y-1">
          {entries.map(([key, val]) => {
            const display = typeof val === "string" ? val : JSON.stringify(val);
            const truncated = display && display.length > 120 ? display.slice(0, 120) + "..." : display;
            return (
              <div key={key}>
                <dt className="inline font-medium">{key}: </dt>
                <dd className="inline">{truncated || "(empty)"}</dd>
              </div>
            );
          })}
        </dl>
      );
    }
  }

  if (nodeType === "DATABASE_FIELD") {
    const name = typeof payload.name === "string" ? payload.name : "";
    const type = typeof payload.type === "string" ? payload.type : "";
    const config = payload.config;
    const configStr = config ? JSON.stringify(config) : "";
    const truncConfig = configStr.length > 200 ? configStr.slice(0, 200) + "..." : configStr;
    return (
      <dl className="text-xs text-muted-foreground mt-2 space-y-1">
        {name && (
          <div>
            <dt className="inline font-medium">Name: </dt>
            <dd className="inline">{name}</dd>
          </div>
        )}
        {type && (
          <div>
            <dt className="inline font-medium">Type: </dt>
            <dd className="inline">{type}</dd>
          </div>
        )}
        {truncConfig && (
          <div>
            <dt className="inline font-medium">Config: </dt>
            <dd className="inline font-mono text-[0.65rem]">{truncConfig}</dd>
          </div>
        )}
      </dl>
    );
  }

  return null;
}

/** Header with version number, formatted trigger, and relative time. */
function VersionPaneHeader({
  version,
  timestamp,
  fallbackLabel,
}: {
  version: VersionDetailResponse | undefined;
  timestamp: string;
  fallbackLabel: string;
}) {
  if (!version) {
    return (
      <div className="text-sm text-muted-foreground">
        <p className="font-medium">{fallbackLabel}</p>
        <p className="text-xs mt-1">{timestamp}</p>
      </div>
    );
  }

  const triggerDisplay = formatTrigger(version.trigger as VersionTrigger);

  return (
    <div className="text-sm text-muted-foreground">
      <p className="font-medium">Version {version.versionNumber}</p>
      <p className="text-xs mt-1">
        {triggerDisplay.label} {timestamp}
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
      </p>
    </div>
  );
}

export function VersionDiffModal({
  open,
  onClose,
  nodeType,
  nodeId,
  fromVersionId,
  toVersionId,
  sourceTitle = "Untitled",
  derivativeCount = 0,
  onBranched,
  databaseId,
}: VersionDiffModalProps) {
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);

  // Fetch the diff
  const diffQuery = useDiff(open ? { fromVersionId, toVersionId } : null);

  // Fetch version details for timestamps
  const toVersionQuery = useVersion(open ? toVersionId : null);
  const fromVersionQuery = useVersion(open && fromVersionId ? fromVersionId : null);

  const isBranchable = BRANCHABLE_TYPES.has(nodeType);

  const toTimestamp = toVersionQuery.data?.createdAt
    ? formatDistanceToNow(new Date(toVersionQuery.data.createdAt), { addSuffix: true })
    : "...";
  const fromTimestamp = fromVersionId
    ? fromVersionQuery.data?.createdAt
      ? formatDistanceToNow(new Date(fromVersionQuery.data.createdAt), { addSuffix: true })
      : "..."
    : "Current (live)";

  const versionLabel = toVersionQuery.data
    ? `version ${toVersionQuery.data.versionNumber} (${toTimestamp})`
    : `version (${toTimestamp})`;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Compare versions</DialogTitle>
            <DialogDescription>
              {fromTimestamp} vs {toTimestamp}
            </DialogDescription>
          </DialogHeader>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pb-2 border-b">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestoreOpen(true)}
              className="gap-1.5"
            >
              <Undo2Icon className="size-3.5" aria-hidden="true" />
              Restore this version
            </Button>
            {isBranchable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBranchOpen(true)}
                className="gap-1.5"
              >
                <GitBranchPlusIcon className="size-3.5" aria-hidden="true" />
                Branch from this version
              </Button>
            )}
          </div>

          {/* Diff body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {diffQuery.isLoading && (
              <div className="space-y-3 py-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {diffQuery.error && (
              <div className="py-6 text-center text-sm text-destructive">
                {diffQuery.error.message || "Failed to compute diff."}
              </div>
            )}

            {diffQuery.data && (
              <>
                {/* Wide viewport: single column diff */}
                <div className="hidden lg:block py-3">
                  <DiffRenderer diff={diffQuery.data} />
                </div>

                {/* Narrow viewport: tabbed layout */}
                <div className="lg:hidden py-3">
                  <Tabs defaultValue="diff">
                    <TabsList>
                      <TabsTrigger value="older">Older</TabsTrigger>
                      <TabsTrigger value="diff">Diff</TabsTrigger>
                      <TabsTrigger value="newer">Newer</TabsTrigger>
                    </TabsList>
                    <TabsContent value="older" className="pt-3">
                      <VersionPaneHeader
                        version={toVersionQuery.data ?? undefined}
                        timestamp={toTimestamp}
                        fallbackLabel="Older version"
                      />
                      {toVersionQuery.data && (
                        <VersionPayloadPreview
                          version={toVersionQuery.data}
                          nodeType={nodeType}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="diff" className="pt-3">
                      <DiffRenderer diff={diffQuery.data} />
                    </TabsContent>
                    <TabsContent value="newer" className="pt-3">
                      {fromVersionId ? (
                        <>
                          <VersionPaneHeader
                            version={fromVersionQuery.data ?? undefined}
                            timestamp={fromTimestamp}
                            fallbackLabel="Newer version"
                          />
                          {fromVersionQuery.data && (
                            <VersionPayloadPreview
                              version={fromVersionQuery.data}
                              nodeType={nodeType}
                            />
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium">Current (live)</p>
                          <p className="text-xs mt-1">This is the current version of the document.</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <RestoreConfirmationDialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        versionId={toVersionId}
        nodeType={nodeType}
        nodeId={nodeId}
        databaseId={databaseId}
        versionLabel={versionLabel}
      />

      {/* Branch dialog */}
      {isBranchable && (
        <BranchDialog
          open={branchOpen}
          onClose={() => setBranchOpen(false)}
          versionId={toVersionId}
          nodeType={nodeType}
          nodeId={nodeId}
          sourceTitle={sourceTitle}
          derivativeCount={derivativeCount}
          onBranched={onBranched}
        />
      )}
    </>
  );
}
