"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
import { useGoals } from "@/lib/hooks/use-goals";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Goal picker that renders the full N-level parent/child hierarchy as
 * a collapsible tree inside a popover. Replaces the old 2-level
 * Select dropdown in todo-filter-bar (M9 from the review).
 *
 * Input: { value, onChange, placeholder }
 *   - value: selected goalId or undefined/null when no filter
 *   - onChange(next) fires with undefined when the user picks "All goals"
 *
 * Internally fetches the goal list via useGoals and builds the tree
 * by grouping on parentId. Every subtree is collapsible; clicking a
 * row selects that goal and closes the popover.
 */

interface FlatGoal {
  id: string;
  title: string;
  parentId: string | null;
}

interface GoalNode {
  id: string;
  title: string;
  children: GoalNode[];
}

function buildTree(flat: FlatGoal[]): GoalNode[] {
  const byId = new Map<string, GoalNode>();
  for (const g of flat) {
    byId.set(g.id, { id: g.id, title: g.title, children: [] });
  }
  const roots: GoalNode[] = [];
  for (const g of flat) {
    const node = byId.get(g.id)!;
    if (g.parentId && byId.has(g.parentId)) {
      byId.get(g.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function flattenIds(nodes: GoalNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    ids.push(n.id);
    if (n.children.length > 0) ids.push(...flattenIds(n.children));
  }
  return ids;
}

interface GoalPickerTreeProps {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function GoalPickerTree({
  value,
  onChange,
  placeholder = "All goals",
  className,
}: GoalPickerTreeProps) {
  const { data: rawGoals } = useGoals();
  const [open, setOpen] = useState(false);
  // Expansion state keyed by goalId. Every node starts collapsed; the
  // user clicks the chevron to drill down. Subtrees containing the
  // currently-selected goal auto-expand on first open so the user can
  // see what they picked.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const goals = useMemo(() => {
    const list = (rawGoals ?? []) as FlatGoal[];
    return list.map((g) => ({ id: g.id, title: g.title, parentId: g.parentId }));
  }, [rawGoals]);

  const tree = useMemo(() => buildTree(goals), [goals]);

  const selectedGoal = value ? goals.find((g) => g.id === value) : null;

  // When the popover opens, auto-expand every ancestor of the current
  // selection so the user can see their choice in context.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && value) {
      const byId = new Map(goals.map((g) => [g.id, g]));
      const toExpand: Record<string, boolean> = {};
      let cursor = byId.get(value);
      while (cursor?.parentId) {
        toExpand[cursor.parentId] = true;
        cursor = byId.get(cursor.parentId);
      }
      setExpanded((prev) => ({ ...prev, ...toExpand }));
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function select(id: string | undefined) {
    onChange(id);
    setOpen(false);
  }

  function expandAll() {
    const allIds = flattenIds(tree);
    const next: Record<string, boolean> = {};
    for (const id of allIds) next[id] = true;
    setExpanded(next);
  }

  function collapseAll() {
    setExpanded({});
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 w-[180px] justify-start text-left font-normal", className)}
          />
        }
      >
        <span className="truncate">
          {selectedGoal
            ? selectedGoal.title.length > 22
              ? `${selectedGoal.title.slice(0, 22)}...`
              : selectedGoal.title
            : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-2 py-1.5">
          <button
            type="button"
            onClick={() => select(undefined)}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-muted",
              !value && "text-primary",
            )}
          >
            {!value && <Check className="size-3" />}
            <span>{placeholder}</span>
          </button>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <button
              type="button"
              onClick={expandAll}
              className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
            >
              expand
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
            >
              collapse
            </button>
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {tree.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No goals yet.
            </p>
          ) : (
            tree.map((node) => (
              <GoalTreeRow
                key={node.id}
                node={node}
                depth={0}
                selectedId={value}
                expanded={expanded}
                onToggle={toggle}
                onSelect={(id) => select(id)}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface GoalTreeRowProps {
  node: GoalNode;
  depth: number;
  selectedId: string | undefined;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

function GoalTreeRow({
  node,
  depth,
  selectedId,
  expanded,
  onToggle,
  onSelect,
}: GoalTreeRowProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded[node.id] ?? false;
  const isSelected = selectedId === node.id;

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-1 text-sm",
          isSelected && "bg-primary/10 text-primary",
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-muted"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={cn(
            "flex-1 truncate rounded px-1 py-0.5 text-left transition-colors hover:bg-muted",
            isSelected && "hover:bg-primary/15",
          )}
        >
          {isSelected && <Check className="mr-1 inline size-3 align-[-1px]" />}
          {node.title}
        </button>
      </div>
      {hasChildren && isOpen && (
        <>
          {node.children.map((child) => (
            <GoalTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  );
}
