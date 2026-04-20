"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCreateTodo, useUpdateTodo } from "@/lib/hooks/use-todos";
import { useGoals } from "@/lib/hooks/use-goals";
import { useCategories } from "@/lib/hooks/use-categories";
import {
  parseNaturalLanguage,
  type ParsedMatch,
} from "@/lib/natural-language/parser";
import { ParsedPreview } from "./parsed-preview";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { TODO_TEMPLATES, type TodoTemplate } from "@/lib/templates/todo-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutTemplate, PlusIcon } from "lucide-react";

const PRIORITY_ABBREV: Record<string, string> = {
  HIGH: "H",
  MEDIUM: "M",
  LOW: "L",
};

const PRIORITY_ORDER = ["HIGH", "MEDIUM", "LOW"] as const;

interface GoalListItem {
  id: string;
  title: string;
}

interface CategoryNode {
  id: string;
  name: string;
  color: string;
  children?: CategoryNode[];
}

function flattenCategories(
  nodes: CategoryNode[],
): Array<{ id: string; name: string; color: string }> {
  const out: Array<{ id: string; name: string; color: string }> = [];
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, color: n.color });
    if (n.children?.length) out.push(...flattenCategories(n.children));
  }
  return out;
}

export function TodoQuickAdd() {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();

  const { data: rawGoals } = useGoals();
  const { data: rawCategories } = useCategories();

  const goals = useMemo(
    () =>
      ((rawGoals ?? []) as GoalListItem[]).map((g) => ({
        id: g.id,
        title: g.title,
      })),
    [rawGoals],
  );

  const categories = useMemo(
    () => flattenCategories(((rawCategories as CategoryNode[]) ?? [])),
    [rawCategories],
  );

  const parsed = useMemo(
    () => parseNaturalLanguage(title, { goals, categories }),
    [title, goals, categories],
  );

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;

    const finalTitle = parsed.title.trim() || trimmed;
    if (!finalTitle) return;

    try {
      const created = await createTodo.mutateAsync({
        title: finalTitle,
        priority:
          parsed.priority ?? (priority as "LOW" | "MEDIUM" | "HIGH"),
        ...(parsed.dueDate && { dueDate: parsed.dueDate }),
        ...(parsed.goalId && { goalId: parsed.goalId }),
        ...(parsed.categoryId && { categoryId: parsed.categoryId }),
      });

      // Big 3 requires a two-step set (create doesn't support isBig3 directly).
      if (parsed.isBig3 && created && typeof created === "object" && "id" in created) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await updateTodo.mutateAsync({
          id: (created as { id: string }).id,
          data: { isBig3: true, big3Date: today.toISOString() },
        });
      }

      toast.success("Todo created!");
      setTitle("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    }
  }

  async function handleApplyTemplate(template: TodoTemplate) {
    try {
      await Promise.all(
        template.todos.map((t) =>
          createTodo.mutateAsync({
            title: t.title,
            priority: t.priority,
            ...(t.description && { description: t.description }),
          })
        )
      );
      toast.success(
        `Created ${template.todos.length} todo${template.todos.length > 1 ? "s" : ""} from "${template.name}"`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to apply template"
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    }
  }

  function handleRemoveToken(type: ParsedMatch["type"]) {
    const match = parsed.matches.find((m) => m.type === type);
    if (!match) return;
    setTitle((t) => t.replace(match.token, " ").replace(/\s+/g, " ").trim());
  }

  // Zod caps todo titles at 200 chars. Surface a counter once the user
  // crosses the 90% threshold so they aren't surprised by a rejected submit. (L14)
  const titleLength = title.length;
  const showCounter = titleLength > 180;
  const atLimit = titleLength >= 200;

  return (
    <div className="flex flex-col rounded-lg border border-border p-1.5 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Quick add a to-do..."
          className="flex-1 border-0 shadow-none focus-visible:ring-0"
          disabled={createTodo.isPending}
          maxLength={200}
        />
        <Select
          value={priority}
          onValueChange={(val) => { if (val) setPriority(val); }}
        >
          <SelectTrigger size="sm" className="w-14 shrink-0">
            <SelectValue>
              {PRIORITY_ABBREV[priority]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_ABBREV[p]} {p.charAt(0) + p.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => setTemplatePickerOpen(true)}
          title="Use a template"
          aria-label="Use a template"
        >
          <LayoutTemplate className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          onClick={handleCreate}
          disabled={!title.trim() || createTodo.isPending}
          aria-label="Add to-do"
        >
          <PlusIcon />
        </Button>
      </div>
      {showCounter && (
        <div className={`px-2 pt-1 text-xs tabular-nums ${atLimit ? "text-destructive" : "text-muted-foreground"}`}>
          {titleLength}/200
        </div>
      )}
      <ParsedPreview parsed={parsed} onRemove={handleRemoveToken} />
      <TemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        templates={TODO_TEMPLATES}
        title="Pick a todo template"
        description="Create a set of todos from a pre-built routine or checklist."
        onPick={handleApplyTemplate}
      />
    </div>
  );
}
