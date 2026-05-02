"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LinkIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface RelationEntry {
  id: string;
  title: string;
  databaseName?: string;
}

interface RelationEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "RELATION" }> };
  value: string[] | null; // entry IDs
  onChange: (next: string[] | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Resolve entry IDs to their display data. The parent provides this. */
  resolvedEntries?: RelationEntry[];
  /** Search function for autocomplete. Returns matching entries. */
  onSearch?: (query: string) => Promise<RelationEntry[]>;
}

// ── Component ─────────────────────────────────────────────────────────────

export function RelationEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
  resolvedEntries = [],
  onSearch,
}: RelationEditorProps) {
  const [open, setOpen] = useState(autoFocus ?? false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<RelationEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIds = new Set(value ?? []);

  // Debounced search
  useEffect(() => {
    if (!onSearch) return;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await onSearch(search.trim());
        // Filter out already selected
        setResults(hits.filter((h) => !selectedIds.has(h.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, onSearch]);

  const addEntry = useCallback(
    (entryId: string) => {
      const current = value ?? [];
      if (current.includes(entryId)) return;
      onChange([...current, entryId]);
      setSearch("");
      setResults([]);
    },
    [value, onChange],
  );

  const removeEntry = useCallback(
    (entryId: string) => {
      const current = value ?? [];
      const next = current.filter((id) => id !== entryId);
      onChange(next.length > 0 ? next : null);
    },
    [value, onChange],
  );

  // ── Pill component ────────────────────────────────────────────────────

  function RelationPill({
    entry,
    showRemove,
  }: {
    entry: RelationEntry;
    showRemove: boolean;
  }) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
        <LinkIcon className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[120px]">{entry.title}</span>
        {showRemove && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeEntry(entry.id);
            }}
            className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
            aria-label={`Remove ${entry.title}`}
          >
            <XIcon className="size-2.5" aria-hidden="true" />
          </button>
        )}
      </span>
    );
  }

  // ── Autocomplete popover content ──────────────────────────────────────

  const autocompleteContent = (
    <div className="flex flex-col gap-1">
      <Input
        ref={inputRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search entries..."
        className="h-8 text-sm"
        aria-label={`Search entries for ${field.name}`}
        autoFocus
      />
      <div className="max-h-48 overflow-y-auto">
        {searching && (
          <p className="text-xs text-muted-foreground px-2 py-2">Searching...</p>
        )}
        {!searching && search.trim() && results.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-2">No matching entries.</p>
        )}
        {results.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => addEntry(entry.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left w-full",
              "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label={`Add ${entry.title}`}
          >
            <LinkIcon className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm">{entry.title}</span>
              {entry.databaseName && (
                <span className="text-xs text-muted-foreground truncate">
                  {entry.databaseName}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {resolvedEntries
            .filter((e) => selectedIds.has(e.id))
            .map((entry) => (
              <RelationPill key={entry.id} entry={entry} showRemove={true} />
            ))}
          {(value ?? []).length === 0 && (
            <span className="text-sm text-muted-foreground">No relations</span>
          )}
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground",
              "border border-dashed hover:bg-muted transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "pointer-events-none opacity-50",
            )}
            aria-label={`Add relation for ${field.name}`}
          >
            <PlusIcon className="size-3" aria-hidden="true" />
            Add relation
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            {autocompleteContent}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // ── Cell mode ─────────────────────────────────────────────────────────

  const visibleEntries = resolvedEntries.filter((e) => selectedIds.has(e.id));
  const cellVisible = visibleEntries.slice(0, 2);
  const cellOverflow = visibleEntries.length - 2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "w-full text-left rounded px-1.5 py-1 transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label={`Edit ${field.name}`}
      >
        {visibleEntries.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {cellVisible.map((entry) => (
              <RelationPill key={entry.id} entry={entry} showRemove={false} />
            ))}
            {cellOverflow > 0 && (
              <span className="text-xs text-muted-foreground">+{cellOverflow}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">&mdash;</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {autocompleteContent}
      </PopoverContent>
    </Popover>
  );
}
