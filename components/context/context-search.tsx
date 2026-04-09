"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchContext } from "@/lib/hooks/use-context";

interface SearchResult {
  id: string;
  title: string;
  content: string;
}

interface ContextSearchProps {
  onSelect: (id: string) => void;
}

export function ContextSearch({ onSelect }: ContextSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useSearchContext(debouncedQuery) as {
    data: SearchResult[] | undefined;
    isLoading: boolean;
  };

  const isActive = debouncedQuery.length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Search context..."
          className="pl-8"
        />
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
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onSelect(r.id);
                  setQuery("");
                  setDebouncedQuery("");
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium truncate w-full">
                  {r.title}
                </span>
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
