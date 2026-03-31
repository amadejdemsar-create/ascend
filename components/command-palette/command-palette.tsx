"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandActions } from "./command-actions";
import { useUIStore } from "@/lib/stores/ui-store";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

interface SearchGoal {
  id: string;
  title: string;
  horizon: string;
  status: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchGoal[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();
  const selectGoal = useUIStore((s) => s.selectGoal);
  const actions = useCommandActions();

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/goals/search?q=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Bearer ${API_KEY}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        // Silently ignore search errors
      }
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSearchResults([]);
  }, []);

  const handleGoalSelect = useCallback(
    (goalId: string) => {
      router.push("/goals");
      selectGoal(goalId);
      handleClose();
    },
    [router, selectGoal, handleClose]
  );

  const handleActionSelect = useCallback(
    (onSelect: () => void) => {
      onSelect();
      handleClose();
    },
    [handleClose]
  );

  // Group actions by their group field
  const actionGroups = actions.reduce<Record<string, typeof actions>>(
    (acc, action) => {
      if (!acc[action.group]) acc[action.group] = [];
      acc[action.group].push(action);
      return acc;
    },
    {}
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search goals or type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {searchResults.length > 0 && (
          <>
            <CommandGroup heading="Goals">
              {searchResults.map((goal) => (
                <CommandItem
                  key={goal.id}
                  value={`goal-${goal.id}-${goal.title}`}
                  onSelect={() => handleGoalSelect(goal.id)}
                >
                  <span className="flex-1 truncate">{goal.title}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {goal.horizon}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {Object.entries(actionGroups).map(([group, groupActions]) => (
          <CommandGroup key={group} heading={group}>
            {groupActions.map((action) => (
              <CommandItem
                key={action.id}
                value={action.id + " " + action.label}
                onSelect={() => handleActionSelect(action.onSelect)}
              >
                <action.icon className="mr-2 size-4" />
                <span>{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
