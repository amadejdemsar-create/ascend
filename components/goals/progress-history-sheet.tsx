"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { HistoryIcon } from "lucide-react";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

interface ProgressEntry {
  id: string;
  value: number;
  note: string | null;
  createdAt: string;
}

function useProgressHistory(goalId: string) {
  return useQuery({
    queryKey: [...queryKeys.goals.detail(goalId), "progress"],
    queryFn: () => fetchJson<ProgressEntry[]>(`/api/goals/${goalId}/progress`),
    enabled: !!goalId,
  });
}

interface ProgressHistorySheetProps {
  goalId: string;
  goalTitle: string;
}

export function ProgressHistorySheet({
  goalId,
  goalTitle,
}: ProgressHistorySheetProps) {
  const { data: entries, isLoading } = useProgressHistory(goalId);

  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" />}
      >
        <HistoryIcon className="size-3.5" />
        History
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>Progress History</SheetTitle>
          <p className="text-sm text-muted-foreground truncate">{goalTitle}</p>
        </SheetHeader>
        <div className="mt-4 space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No progress entries yet. Use the +1 button to start tracking.
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-border p-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-primary">
                    +{entry.value}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                {entry.note && (
                  <p className="text-xs text-muted-foreground">{entry.note}</p>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
