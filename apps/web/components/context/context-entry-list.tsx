"use client";

import { useMemo } from "react";
import { FileText, Pin, Zap, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useListNavigation } from "@/lib/hooks/use-list-navigation";
import { nodeColor } from "@ascend/graph";
import type { ContextEntryType } from "@ascend/core";
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_ICONS,
} from "@/components/context/context-type-select";
import { cn } from "@/lib/utils";

export interface ContextEntryItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  isPinned: boolean;
  type?: ContextEntryType;
  category?: { id: string; name: string; color: string } | null;
}

interface ContextEntryListProps {
  entries: ContextEntryItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  currentPrioritiesSelected?: boolean;
  onSelectCurrentPriorities?: () => void;
  hasCategoryFilter?: boolean;
  tagFilter?: string | null;
  onClearTagFilter?: () => void;
  onTagClick: (tag: string) => void;
  onTogglePin: (id: string, currentlyPinned: boolean) => void;
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "") // fenced code
    .replace(/`[^`]*`/g, "") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // wikilinks
    .replace(/[#*_~>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function readTime(words: number): number {
  return Math.max(1, Math.round(words / 200));
}

interface RowProps {
  entry: ContextEntryItem;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (id: string) => void;
  onTagClick: (tag: string) => void;
}

function ContextRow({
  entry,
  isSelected,
  isFocused,
  onSelect,
  onTagClick,
}: RowProps) {
  const snippet = stripMarkdown(entry.content).slice(0, 120);
  const truncated = entry.content.length > 120 ? "…" : "";
  const wc = wordCount(entry.content);
  const rt = readTime(wc);

  return (
    <button
      type="button"
      data-list-item-id={entry.id}
      onClick={() => onSelect(entry.id)}
      className={cn(
        "flex flex-col gap-1.5 w-full rounded-lg border p-3 text-left transition-colors",
        isSelected
          ? "border-primary/30 bg-primary/5"
          : "border-transparent hover:border-border hover:bg-muted/40",
        isFocused && "ring-2 ring-primary ring-inset",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {entry.isPinned && (
            <>
              <Pin aria-hidden="true" className="size-3.5 shrink-0 text-amber-500 fill-amber-500" />
              <span className="sr-only">Pinned</span>
            </>
          )}
          <span className="text-sm font-medium truncate">{entry.title}</span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDistanceToNowStrict(new Date(entry.updatedAt), {
            addSuffix: true,
          })}
        </span>
      </div>
      {snippet && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {snippet}
          {truncated}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {entry.type && (() => {
          const entryType = entry.type;
          const TypeIcon = ENTRY_TYPE_ICONS[entryType] ?? ENTRY_TYPE_ICONS.NOTE;
          const color = nodeColor(entryType);
          return (
            <Badge
              variant="secondary"
              className="text-[0.6rem] px-1.5 py-0 gap-0.5"
              style={{ borderColor: `${color}40` }}
            >
              <TypeIcon className="size-2.5" style={{ color }} aria-hidden="true" />
              {ENTRY_TYPE_LABELS[entryType]}
            </Badge>
          );
        })()}
        {entry.tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTagClick(t);
            }}
            className="text-[0.65rem] text-muted-foreground hover:text-primary hover:bg-muted rounded px-1.5 py-0.5"
          >
            #{t}
          </button>
        ))}
        <span className="text-[0.65rem] text-muted-foreground">
          {entry.tags.length > 0 || entry.type ? "·" : ""} {wc} words · {rt} min
        </span>
      </div>
    </button>
  );
}

interface SectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
}

function Section({ title, count, children }: SectionProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
        <span>{title}</span>
        {typeof count === "number" && (
          <span className="text-[0.65rem] text-muted-foreground/70">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function ContextEntryList({
  entries,
  selectedId,
  onSelect,
  isLoading,
  currentPrioritiesSelected,
  onSelectCurrentPriorities,
  hasCategoryFilter,
  tagFilter,
  onClearTagFilter,
  onTagClick,
  onTogglePin: _onTogglePin,
}: ContextEntryListProps) {
  // _onTogglePin is reserved for future row-level pin toggling (e.g., context menu).
  // The prop is accepted now so the page can wire it without another refactor.
  void _onTogglePin;

  const isSectioned = !hasCategoryFilter && !tagFilter;

  // Compute the "recent" cutoff outside the memo body. React Compiler's
  // purity lint flags Date.now() inside useMemo; reading it during render
  // of the component body itself is the same, but we at least make it
  // explicit and narrow the scope of the impurity.
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const sections = useMemo(() => {
    if (!isSectioned) {
      return null;
    }

    const pinned = entries.filter((e) => e.isPinned);
    const pinnedIds = new Set(pinned.map((e) => e.id));

    const recent = entries
      .filter(
        (e) =>
          !pinnedIds.has(e.id) &&
          new Date(e.updatedAt).getTime() >= sevenDaysAgoMs,
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 5);
    const recentIds = new Set(recent.map((e) => e.id));

    const weeklyReviews = entries
      .filter(
        (e) => !pinnedIds.has(e.id) && e.tags.includes("weekly-review"),
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    const weeklyReviewIds = new Set(weeklyReviews.map((e) => e.id));

    const rest = entries
      .filter(
        (e) =>
          !pinnedIds.has(e.id) &&
          !recentIds.has(e.id) &&
          !weeklyReviewIds.has(e.id),
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    return { pinned, recent, weeklyReviews, rest };
  }, [entries, isSectioned, sevenDaysAgoMs]);

  // Build a flat ordered list of entries for keyboard nav matching the
  // rendered DOM order so j/k cycles through sections naturally.
  const navItems = useMemo(() => {
    if (!sections) {
      return entries;
    }
    return [
      ...sections.pinned,
      ...sections.recent,
      ...sections.weeklyReviews,
      ...sections.rest,
    ];
  }, [entries, sections]);

  const { focusedId } = useListNavigation({
    items: navItems,
    getId: (e) => e.id,
    onOpen: (e) => onSelect(e.id),
    enabled: !isLoading,
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const showEmptyState =
    entries.length === 0 && !onSelectCurrentPriorities && !tagFilter;

  return (
    <div className="space-y-4 p-2">
      {/* Tag filter chip */}
      {tagFilter && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">Filtered by</span>
          <button
            type="button"
            onClick={onClearTagFilter}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/15"
          >
            #{tagFilter}
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Current Priorities pinned entry (only when not filtering) */}
      {onSelectCurrentPriorities && !tagFilter && !hasCategoryFilter && (
        <button
          onClick={onSelectCurrentPriorities}
          className={cn(
            "flex w-full flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
            currentPrioritiesSelected
              ? "border-primary/50 bg-primary/10"
              : "border-primary/30 bg-primary/5 hover:bg-primary/10",
          )}
        >
          <div className="flex items-center gap-2 w-full">
            <Zap className="size-3.5 text-amber-500 shrink-0" />
            <span className="text-sm font-medium truncate">
              Current Priorities
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              <Badge
                variant="secondary"
                className="text-[0.6rem] px-1.5 py-0"
              >
                Dynamic · live
              </Badge>
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Derived from active goals and today&apos;s Big 3
          </span>
        </button>
      )}

      {showEmptyState && (
        <EmptyState
          icon={FileText}
          title="No context documents"
          description="Your knowledge base is empty. Click New above to create your first document."
        />
      )}

      {entries.length === 0 && tagFilter && (
        <EmptyState
          icon={FileText}
          title={`No entries match #${tagFilter}`}
          description="Clear the tag filter to see all documents."
        />
      )}

      {/* Flat list when filtered */}
      {!isSectioned && entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((entry) => (
            <ContextRow
              key={entry.id}
              entry={entry}
              isSelected={selectedId === entry.id}
              isFocused={focusedId === entry.id}
              onSelect={onSelect}
              onTagClick={onTagClick}
            />
          ))}
        </div>
      )}

      {/* Sectioned layout */}
      {isSectioned && sections && (
        <>
          {sections.pinned.length > 0 && (
            <Section title="Pinned" count={sections.pinned.length}>
              {sections.pinned.map((entry) => (
                <ContextRow
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedId === entry.id}
                  isFocused={focusedId === entry.id}
                  onSelect={onSelect}
                  onTagClick={onTagClick}
                />
              ))}
            </Section>
          )}

          {sections.recent.length > 0 && (
            <Section title="Recent" count={sections.recent.length}>
              {sections.recent.map((entry) => (
                <ContextRow
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedId === entry.id}
                  isFocused={focusedId === entry.id}
                  onSelect={onSelect}
                  onTagClick={onTagClick}
                />
              ))}
            </Section>
          )}

          {sections.weeklyReviews.length > 0 && (
            <Collapsible>
              <div className="space-y-1.5">
                <CollapsibleTrigger className="flex w-full items-center gap-2 px-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  <span>Weekly Reviews</span>
                  <span className="text-[0.65rem] text-muted-foreground/70">
                    {sections.weeklyReviews.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1">
                    {sections.weeklyReviews.map((entry) => (
                      <ContextRow
                        key={entry.id}
                        entry={entry}
                        isSelected={selectedId === entry.id}
                        isFocused={focusedId === entry.id}
                        onSelect={onSelect}
                        onTagClick={onTagClick}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {sections.rest.length > 0 && (
            <Section title="All" count={sections.rest.length}>
              {sections.rest.map((entry) => (
                <ContextRow
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedId === entry.id}
                  isFocused={focusedId === entry.id}
                  onSelect={onSelect}
                  onTagClick={onTagClick}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
