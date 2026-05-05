"use client";

import type { BlockDiffResult, TextDiffOp } from "@ascend/diff";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BlockDiffRendererProps {
  diff: BlockDiffResult;
}

function InlineTextDiff({ ops }: { ops: TextDiffOp[] }) {
  return (
    <span>
      {ops.map((op, i) => {
        switch (op.op) {
          case "equal":
            return <span key={i}>{op.text}</span>;
          case "insert":
            return (
              <span
                key={i}
                className="text-green-700 dark:text-green-400 underline decoration-green-700/60"
              >
                {op.text}
              </span>
            );
          case "delete":
            return (
              <span
                key={i}
                className="text-red-700 dark:text-red-400 line-through decoration-red-700/60"
              >
                {op.text}
              </span>
            );
        }
      })}
    </span>
  );
}

const CHANGE_BADGES: Record<
  string,
  { label: string; variant: "default" | "destructive" | "secondary" | "outline" }
> = {
  added: { label: "Added", variant: "default" },
  removed: { label: "Removed", variant: "destructive" },
  moved: { label: "Moved", variant: "secondary" },
  modified: { label: "Modified", variant: "outline" },
};

export function BlockDiffRenderer({ diff }: BlockDiffRendererProps) {
  if (diff.blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No block-level changes detected.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {diff.blocks.map((entry, i) => {
        const badgeInfo = CHANGE_BADGES[entry.change];
        const blockType = entry.block.blockType;

        return (
          <div
            key={`${entry.block.blockId}-${i}`}
            className={cn(
              "rounded-md border p-3 text-sm",
              entry.change === "added" && "border-green-700/40 bg-green-50 dark:bg-green-950/20",
              entry.change === "removed" && "border-red-700/40 bg-red-50 dark:bg-red-950/20",
              entry.change === "moved" && "border-blue-700/40 bg-blue-50 dark:bg-blue-950/20",
              entry.change === "modified" && "border-amber-700/40 bg-amber-50 dark:bg-amber-950/20",
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant={badgeInfo.variant} className="text-[0.6rem] px-1.5 py-0">
                {badgeInfo.label}
              </Badge>
              <span className="text-[0.65rem] font-mono text-muted-foreground">
                {blockType}
              </span>
            </div>

            {/* Body */}
            {entry.change === "added" && (
              <p className="whitespace-pre-wrap text-green-700 dark:text-green-400 border-l-2 border-green-700/40 pl-2">
                {entry.block.text}
              </p>
            )}
            {entry.change === "removed" && (
              <p className="whitespace-pre-wrap text-red-700 dark:text-red-400 line-through border-l-2 border-red-700/40 pl-2">
                {entry.block.text}
              </p>
            )}
            {entry.change === "moved" && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Moved from position {entry.fromIndex} to position {entry.toIndex}
                </p>
                <p className="whitespace-pre-wrap border-l-2 border-blue-700/40 pl-2">
                  {entry.block.text}
                </p>
              </div>
            )}
            {entry.change === "modified" && (
              <div className="whitespace-pre-wrap border-l-2 border-amber-700/40 pl-2">
                <InlineTextDiff ops={entry.textDiff.ops} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
