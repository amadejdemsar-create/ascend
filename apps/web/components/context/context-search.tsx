"use client";

import { useState, useEffect } from "react";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSearchContext, type ContextSearchResult } from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { SemanticSearchToggle } from "@/components/context/semantic-search-toggle";

interface ContextSearchProps {
  onSelect: (id: string) => void;
}

export function ContextSearch({ onSelect }: ContextSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const contextSearchMode = useUIStore((s) => s.contextSearchMode);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSearchContext(debouncedQuery, {
    mode: contextSearchMode,
  });

  const isActive = debouncedQuery.length > 0;
  const showAiIndicator =
    isActive && (contextSearchMode === "semantic" || contextSearchMode === "hybrid");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="Search context..."
            className="pl-8"
            aria-label="Search context entries"
          />
          {showAiIndicator && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3" aria-hidden="true" />
              <span className="hidden sm:inline">AI</span>
            </span>
          )}
        </div>
        <SemanticSearchToggle />
      </div>

      {isActive && (
        <div className="space-y-1">
          {isLoading && (
            <div className="space-y-1.5 p-1">
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-8 w-3/4 rounded" />
            </div>
          )}

          {!isLoading && results && results.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No results found
            </p>
          )}

          {!isLoading &&
            results &&
            results.length > 0 &&
            results.map((r: ContextSearchResult) => (
              <button
                key={r.id}
                onClick={() => {
                  onSelect(r.id);
                  setQuery("");
                  setDebouncedQuery("");
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors"
              >
                <div className="flex w-full items-center gap-1.5">
                  <span className="text-sm font-medium truncate flex-1">
                    {r.title}
                  </span>
                  {r.matchedVia && (
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] px-1 py-0 h-4"
                    >
                      {r.matchedVia === "both"
                        ? "text+semantic"
                        : r.matchedVia}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate w-full">
                  {r.content.replace(/[#*_`~\[\]]/g, "").slice(0, 100)}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
