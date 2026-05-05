"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Undo2Icon, GitBranchPlusIcon } from "lucide-react";
import { useDiff, useVersion } from "@/lib/hooks/use-versions";
import type { NodeType } from "@/lib/validations";
import type { DiffResult } from "@ascend/diff";
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
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium">
                          {toVersionQuery.data
                            ? `Version ${toVersionQuery.data.versionNumber}`
                            : "Older version"}
                        </p>
                        <p className="text-xs mt-1">{toTimestamp}</p>
                        {toVersionQuery.data?.trigger && (
                          <p className="text-xs mt-0.5">Trigger: {toVersionQuery.data.trigger}</p>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="diff" className="pt-3">
                      <DiffRenderer diff={diffQuery.data} />
                    </TabsContent>
                    <TabsContent value="newer" className="pt-3">
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium">
                          {fromVersionId
                            ? fromVersionQuery.data
                              ? `Version ${fromVersionQuery.data.versionNumber}`
                              : "Newer version"
                            : "Current (live)"}
                        </p>
                        <p className="text-xs mt-1">{fromTimestamp}</p>
                      </div>
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
