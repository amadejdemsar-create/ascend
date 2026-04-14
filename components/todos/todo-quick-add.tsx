"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateTodo } from "@/lib/hooks/use-todos";
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

export function TodoQuickAdd() {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const createTodo = useCreateTodo();

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;

    try {
      await createTodo.mutateAsync({
        title: trimmed,
        priority: priority as "LOW" | "MEDIUM" | "HIGH",
      });
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

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border p-1.5 min-w-0">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Quick add a to-do..."
        className="flex-1 border-0 shadow-none focus-visible:ring-0"
        disabled={createTodo.isPending}
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
