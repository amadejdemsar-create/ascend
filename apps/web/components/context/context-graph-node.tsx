"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import {
  FileText,
  BookOpen,
  Briefcase,
  User,
  CheckCircle,
  HelpCircle,
  Target,
  Pin,
  Link2,
} from "lucide-react";
import { nodeColor } from "@ascend/graph";
import type { ContextEntryType } from "@ascend/core";
import { cn } from "@/lib/utils";

// ── Type icon mapping ──────────────────────────────────────────────

const TYPE_ICONS: Record<ContextEntryType, typeof FileText> = {
  NOTE: FileText,
  SOURCE: BookOpen,
  PROJECT: Briefcase,
  PERSON: User,
  DECISION: CheckCircle,
  QUESTION: HelpCircle,
  AREA: Target,
};

function typeIcon(type: ContextEntryType) {
  return TYPE_ICONS[type] ?? FileText;
}

// ── Node data shape ────────────────────────────────────────────────

export interface ContextNodeData {
  title: string;
  type: ContextEntryType;
  isPinned: boolean;
  outgoingCount: number;
  incomingCount: number;
  [key: string]: unknown;
}

type ContextNodeType = Node<ContextNodeData, "contextNode">;

// ── Component ──────────────────────────────────────────────────────

function ContextGraphNodeInner({ data, selected }: NodeProps<ContextNodeType>) {
  const Icon = typeIcon(data.type);
  const color = nodeColor(data.type);
  const linkCount = (data.outgoingCount ?? 0) + (data.incomingCount ?? 0);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-none"
        style={{ background: color }}
      />
      <div
        className={cn(
          "rounded-lg border-2 bg-background px-3 py-2 shadow-sm transition-shadow min-w-[120px] max-w-[200px]",
          selected && "ring-2 ring-primary ring-offset-1",
        )}
        style={{ borderColor: color }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex size-6 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="size-3.5" style={{ color }} aria-hidden="true" />
          </div>
          <span className="truncate text-xs font-medium leading-tight">
            {data.title}
          </span>
        </div>

        {/* Badges row */}
        <div className="mt-1.5 flex items-center gap-1.5">
          {data.isPinned && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              aria-label="Pinned"
            >
              <Pin className="size-2.5" aria-hidden="true" />
            </span>
          )}
          {linkCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Link2 className="size-2.5" aria-hidden="true" />
              {linkCount}
            </span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-none"
        style={{ background: color }}
      />
    </>
  );
}

export const ContextGraphNode = memo(ContextGraphNodeInner);
