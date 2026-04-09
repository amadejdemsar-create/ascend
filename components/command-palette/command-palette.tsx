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

interface SearchTodo {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  completed: boolean;
}

interface SearchContext {
  id: string;
  title: string;
  categoryId: string | null;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchGoal[]>([]);
  const [todoResults, setTodoResults] = useState<SearchTodo[]>([]);
  const [contextResults, setContextResults] = useState<SearchContext[]>([]);
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

  // Debounced search across goals, todos, and context
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setSearchResults([]);
      setTodoResults([]);
      setContextResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const encodedQuery = encodeURIComponent(query);
        const headers = { Authorization: `Bearer ${API_KEY}` };

        const [goalsRes, todosRes, contextRes] = await Promise.allSettled([
          fetch(`/api/goals/search?q=${encodedQuery}`, { headers }),
          fetch(`/api/todos/search?q=${encodedQuery}`, { headers }),
          fetch(`/api/context/search?q=${encodedQuery}`, { headers }),
        ]);

        if (goalsRes.status === "fulfilled" && goalsRes.value.ok) {
          setSearchResults(await goalsRes.value.json());
        } else {
          setSearchResults([]);
        }

        if (todosRes.status === "fulfilled" && todosRes.value.ok) {
          setTodoResults(await todosRes.value.json());
        } else {
          setTodoResults([]);
        }

        if (contextRes.status === "fulfilled" && contextRes.value.ok) {
          setContextResults(await contextRes.value.json());
        } else {
          setContextResults([]);
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
    setTodoResults([]);
    setContextResults([]);
  }, []);

  const handleGoalSelect = useCallback(
    (goalId: string) => {
      router.push("/goals");
      selectGoal(goalId);
      handleClose();
    },
    [router, selectGoal, handleClose]
  );

  const handleTodoSelect = useCallback(
    () => {
      router.push("/todos");
      handleClose();
    },
    [router, handleClose]
  );

  const handleContextSelect = useCallback(
    (contextId: string) => {
      router.push(`/context?id=${contextId}`);
      handleClose();
    },
    [router, handleClose]
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

  const hasSearchResults = searchResults.length > 0 || todoResults.length > 0 || contextResults.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search goals, todos, context..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {searchResults.length > 0 && (
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
        )}

        {todoResults.length > 0 && (
          <CommandGroup heading="Todos">
            {todoResults.map((todo) => (
              <CommandItem
                key={todo.id}
                value={`todo-${todo.id}-${todo.title}`}
                onSelect={() => handleTodoSelect()}
              >
                <span className="flex-1 truncate">{todo.title}</span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {todo.priority}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {contextResults.length > 0 && (
          <CommandGroup heading="Context">
            {contextResults.map((ctx) => (
              <CommandItem
                key={ctx.id}
                value={`context-${ctx.id}-${ctx.title}`}
                onSelect={() => handleContextSelect(ctx.id)}
              >
                <span className="flex-1 truncate">{ctx.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasSearchResults && <CommandSeparator />}

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
