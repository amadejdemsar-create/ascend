"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useContextEntries, useSearchContext } from "@/lib/hooks/use-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ENTRY_TYPE_LABEL: Record<string, string> = {
  NOTE: "Note",
  SOURCE: "Source",
  PROJECT: "Project",
  PERSON: "Person",
  DECISION: "Decision",
  QUESTION: "Question",
  AREA: "Area",
  DATABASE: "Database",
  RECORD: "Record",
};

const MAX_VISIBLE = 50;

interface ContextEntryItem {
  id: string;
  title: string;
  type?: string;
  tags?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set of contextEntryIds already on the canvas. */
  existingEntryIds: Set<string>;
  /** Called when the user picks an entry that is NOT yet on the canvas. */
  onAddEntry: (entryId: string) => void;
  /** Called when the user picks an entry that IS already on the canvas. */
  onFocusExisting: (entryId: string) => void;
}

/**
 * Wave 9: picker dialog for adding a specific context entry to the
 * spatial canvas. Provides a search input that filters entries by
 * title. Clicking an already-present entry pans to it instead of
 * duplicating.
 */
export function CanvasAddCardDialog({
  open,
  onOpenChange,
  existingEntryIds,
  onAddEntry,
  onFocusExisting,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all entries for the initial list.
  const allEntries = useContextEntries();
  // Search when the user types.
  const searchResults = useSearchContext(query);

  const items: ContextEntryItem[] = useMemo(() => {
    if (query.length > 0 && searchResults.data) {
      return (searchResults.data as ContextEntryItem[]).slice(0, MAX_VISIBLE);
    }
    if (!query && allEntries.data) {
      return (allEntries.data as ContextEntryItem[]).slice(0, MAX_VISIBLE);
    }
    return [];
  }, [query, searchResults.data, allEntries.data]);

  const totalCount = useMemo(() => {
    if (query.length > 0 && searchResults.data) {
      return (searchResults.data as unknown[]).length;
    }
    if (!query && allEntries.data) {
      return (allEntries.data as unknown[]).length;
    }
    return 0;
  }, [query, searchResults.data, allEntries.data]);

  // Reset active index when items change.
  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  // Reset query when dialog opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus the input after the dialog animation settles.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback(
    (entryId: string) => {
      if (existingEntryIds.has(entryId)) {
        onFocusExisting(entryId);
        toast.success("Entry already on canvas; centered.");
      } else {
        onAddEntry(entryId);
      }
      onOpenChange(false);
    },
    [existingEntryIds, onAddEntry, onFocusExisting, onOpenChange],
  );

  // Keyboard navigation.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[activeIndex];
        if (item) handleSelect(item.id);
      }
    },
    [items, activeIndex, handleSelect],
  );

  // Scroll active item into view.
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const isSearching = query.length > 0 && searchResults.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Add card to canvas</DialogTitle>
          <DialogDescription>
            Search for a context entry to place on the canvas.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search entries by title..."
            className="pl-9"
            aria-label="Search context entries"
            autoFocus
          />
        </div>
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto rounded-md border"
          role="listbox"
          aria-label="Context entries"
        >
          {isSearching && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {!isSearching && items.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {query ? "No entries match your search." : "No context entries found."}
            </div>
          )}
          {items.map((item, i) => {
            const isOnCanvas = existingEntryIds.has(item.id);
            const typeLabel =
              ENTRY_TYPE_LABEL[item.type ?? "NOTE"] ?? "Note";
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                data-index={i}
                aria-selected={i === activeIndex}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                  i === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50",
                  isOnCanvas && "opacity-70",
                )}
                onClick={() => handleSelect(item.id)}
              >
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {typeLabel}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.title || "Untitled"}</span>
                {isOnCanvas && (
                  <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                    On canvas
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {totalCount > MAX_VISIBLE && (
          <p className="text-center text-xs text-muted-foreground">
            Showing {MAX_VISIBLE} of {totalCount} entries. Refine your search
            to find a specific one.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
