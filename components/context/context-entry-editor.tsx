"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, ArrowLeftIcon } from "lucide-react";
import {
  useContextEntry,
  useCreateContext,
  useUpdateContext,
} from "@/lib/hooks/use-context";
import { useCategories } from "@/lib/hooks/use-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EntryData = Record<string, any>;

interface CategoryFlat {
  id: string;
  name: string;
  color: string;
  children?: CategoryFlat[];
}

function flattenCategories(
  nodes: CategoryFlat[],
  depth = 0,
): Array<CategoryFlat & { depth: number }> {
  const result: Array<CategoryFlat & { depth: number }> = [];
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children?.length) {
      result.push(...flattenCategories(node.children, depth + 1));
    }
  }
  return result;
}

interface ContextEntryEditorProps {
  entryId?: string;
  onSave: (id: string) => void;
  onCancel: () => void;
}

export function ContextEntryEditor({
  entryId,
  onSave,
  onCancel,
}: ContextEntryEditorProps) {
  const isEditing = !!entryId;

  const { data: entryRaw, isLoading: entryLoading } = useContextEntry(
    entryId ?? "",
  );
  const entry = entryRaw as EntryData | undefined;

  const { data: categoryTree } = useCategories();
  const createContext = useCreateContext();
  const updateContext = useUpdateContext();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [initialized, setInitialized] = useState(false);

  const flatCategories = categoryTree
    ? flattenCategories(categoryTree as CategoryFlat[])
    : [];

  // Populate form when editing
  useEffect(() => {
    if (isEditing && entry && !initialized) {
      setTitle(entry.title ?? "");
      setContent(entry.content ?? "");
      setCategoryId(entry.categoryId ?? "");
      setTags(entry.tags ?? []);
      setInitialized(true);
    }
    if (!isEditing && !initialized) {
      setInitialized(true);
    }
  }, [isEditing, entry, initialized]);

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, "");
      if (val && !tags.includes(val) && tags.length < 20) {
        setTags([...tags, val]);
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    const data = {
      title: title.trim(),
      content: content.trim(),
      categoryId: categoryId || undefined,
      tags,
    };

    try {
      if (isEditing && entryId) {
        const result = (await updateContext.mutateAsync({
          id: entryId,
          data,
        })) as EntryData;
        onSave(result.id);
      } else {
        const result = (await createContext.mutateAsync(data)) as EntryData;
        onSave(result.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast.error(message);
    }
  }

  const isSaving = createContext.isPending || updateContext.isPending;

  if (isEditing && entryLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full flex-col overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b p-4">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h2 className="text-lg font-serif font-semibold flex-1">
          {isEditing ? "Edit Document" : "New Document"}
        </h2>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Form fields */}
      <div className="flex-1 space-y-4 p-4">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="context-title" className="text-xs text-muted-foreground">
            Title
          </Label>
          <Input
            id="context-title"
            value={title}
            onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
            placeholder="Document title"
            required
          />
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <Label htmlFor="context-content" className="text-xs text-muted-foreground">
            Content
          </Label>
          <Textarea
            id="context-content"
            value={content}
            onChange={(e) => setContent((e.target as HTMLTextAreaElement).value)}
            placeholder="Write your content in Markdown..."
            rows={12}
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">
            Supports Markdown. Use [[Title]] to link to other documents.
          </p>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select
            value={categoryId}
            onValueChange={(v) => setCategoryId(v ?? "")}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {flatCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span
                    style={{
                      paddingLeft:
                        cat.depth > 0 ? `${cat.depth * 12}px` : undefined,
                    }}
                  >
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label htmlFor="context-tags" className="text-xs text-muted-foreground">
            Tags
          </Label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="gap-1 text-xs pr-1"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            id="context-tags"
            value={tagInput}
            onChange={(e) => setTagInput((e.target as HTMLInputElement).value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Type a tag and press Enter"
            disabled={tags.length >= 20}
          />
        </div>
      </div>
    </form>
  );
}
