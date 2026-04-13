"use client";

import { FileText, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ContextEntryItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  category?: { id: string; name: string; color: string } | null;
}

interface ContextEntryListProps {
  entries: ContextEntryItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  currentPrioritiesSelected?: boolean;
  onSelectCurrentPriorities?: () => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

export function ContextEntryList({
  entries,
  selectedId,
  onSelect,
  isLoading,
  currentPrioritiesSelected,
  onSelectCurrentPriorities,
}: ContextEntryListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {/* Current Priorities pinned entry */}
      {onSelectCurrentPriorities && (
        <button
          onClick={onSelectCurrentPriorities}
          className={cn(
            "flex w-full flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
            currentPrioritiesSelected
              ? "border-primary/30 bg-primary/5"
              : "border-transparent hover:bg-muted/50",
          )}
        >
          <div className="flex items-center gap-2 w-full">
            <Zap className="size-3.5 text-amber-500 shrink-0" />
            <span className="text-sm font-medium truncate">
              Current Priorities
            </span>
            <Badge variant="secondary" className="ml-auto text-[0.6rem] px-1.5 py-0">
              Auto
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Derived from active goals and today&apos;s Big 3
          </span>
        </button>
      )}

      {entries.length === 0 && !onSelectCurrentPriorities && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <FileText className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-lg font-medium">No context documents</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your knowledge base is empty. Click <span className="font-medium text-foreground">New</span> above to create your first document: a weekly review template, project notes, or anything you want your AI to remember.
          </p>
        </div>
      )}

      {entries.map((entry) => {
        const snippet = stripMarkdown(entry.content).slice(0, 80);

        return (
          <button
            key={entry.id}
            onClick={() => onSelect(entry.id)}
            className={cn(
              "flex w-full flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
              selectedId === entry.id
                ? "border-primary/30 bg-primary/5"
                : "border-transparent hover:bg-muted/50",
            )}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm font-medium truncate flex-1">
                {entry.title}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelativeDate(entry.updatedAt)}
              </span>
            </div>

            {snippet && (
              <span className="text-xs text-muted-foreground truncate w-full">
                {snippet}
              </span>
            )}

            {entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {entry.tags.slice(0, 4).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[0.6rem] px-1.5 py-0"
                  >
                    {tag}
                  </Badge>
                ))}
                {entry.tags.length > 4 && (
                  <span className="text-[0.6rem] text-muted-foreground">
                    +{entry.tags.length - 4}
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
