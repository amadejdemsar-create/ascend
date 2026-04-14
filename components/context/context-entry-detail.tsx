"use client";

import { useState, useMemo, useEffect } from "react";
import { marked } from "marked";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  Link2,
  Zap,
  Pin,
} from "lucide-react";
import {
  useContextEntries,
  useContextEntry,
  useDeleteContext,
  useTogglePin,
  useUpdateContext,
} from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EntryData = Record<string, any>;

interface ContextEntryDetailProps {
  entryId: string;
  onClose: () => void;
  onEdit: () => void;
  onNavigate?: (id: string) => void;
  isMobileOverlay?: boolean;
}

interface CurrentPrioritiesData {
  title: string;
  content: string;
}

function useCurrentPriorities(enabled: boolean) {
  const [data, setData] = useState<CurrentPrioritiesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    setIsLoading(true);
    apiFetch<CurrentPrioritiesData>("/api/context/current-priorities")
      .then((json) => setData(json))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [enabled]);

  return { data, isLoading };
}

/**
 * Escape a string so it can be safely embedded into an HTML attribute value.
 * Used when injecting resolved wikilink ids / titles into the rendered markup
 * after `marked()` returns raw HTML.
 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function ContextEntryDetail({
  entryId,
  onClose,
  onEdit,
  onNavigate,
  isMobileOverlay,
}: ContextEntryDetailProps) {
  const isCurrentPriorities = entryId === "__current_priorities__";

  const { data: entryRaw, isLoading: entryLoading } = useContextEntry(
    isCurrentPriorities ? "" : entryId,
  );
  const { data: cpData, isLoading: cpLoading } =
    useCurrentPriorities(isCurrentPriorities);

  // Fetch all entries (unfiltered) to build a title -> id map for wikilink
  // resolution. Cheap because the list endpoint is cached by React Query.
  const { data: allEntriesRaw } = useContextEntries();

  const entry = entryRaw as EntryData | undefined;
  const deleteContext = useDeleteContext();
  const updateContext = useUpdateContext();
  const togglePin = useTogglePin();
  const setContextTagFilter = useUIStore((s) => s.setContextTagFilter);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Edit mode is keyed by entryId so switching entries automatically exits
  // editing without an effect that calls setIsEditing(false).
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const isEditing = editingKey === entryId;
  const [draft, setDraft] = useState<string>("");

  const isLoading = isCurrentPriorities ? cpLoading : entryLoading;

  const sourceContent = isCurrentPriorities
    ? cpData?.content ?? ""
    : entry?.content ?? "";

  // Build a map of title -> id for wikilink resolution.
  const titleToId = useMemo(() => {
    const map = new Map<string, string>();
    const list = (allEntriesRaw ?? []) as Array<{ id: string; title: string }>;
    for (const e of list) {
      map.set(e.title, e.id);
    }
    return map;
  }, [allEntriesRaw]);

  // Render markdown content with [[wikilinks]] resolved to actual links.
  const renderedHtml = useMemo(() => {
    const html = marked.parse(sourceContent, { async: false }) as string;

    return html.replace(/\[\[([^\]]+)\]\]/g, (_match, rawTitle: string) => {
      const title = rawTitle.trim();
      const id = titleToId.get(title);
      const safeTitle = escapeHtmlAttr(title);
      if (id) {
        return `<a data-wikilink-id="${escapeHtmlAttr(id)}" class="text-primary underline hover:text-primary/80 cursor-pointer">${safeTitle}</a>`;
      }
      return `<span class="text-muted-foreground line-through" title="Unresolved wikilink">${safeTitle}</span>`;
    });
  }, [sourceContent, titleToId]);

  function enterEdit() {
    if (isCurrentPriorities) return;
    setDraft(sourceContent);
    setEditingKey(entryId);
  }

  function exitEdit() {
    setEditingKey(null);
  }

  async function saveDraft() {
    if (isCurrentPriorities) {
      exitEdit();
      return;
    }
    if (!entry) {
      exitEdit();
      return;
    }
    if (draft === entry.content) {
      exitEdit();
      return;
    }
    try {
      await updateContext.mutateAsync({
        id: entryId,
        data: { content: draft },
      });
      exitEdit();
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft(sourceContent);
      exitEdit();
    }
  }

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const link = target.closest("[data-wikilink-id]") as HTMLElement | null;
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      const id = link.dataset.wikilinkId;
      if (id) onNavigate?.(id);
      return;
    }

    // Clicking the rendered content (outside a wikilink) enters edit mode,
    // but only for real entries (not the dynamic Current Priorities view).
    enterEdit();
  }

  function handleContentKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (isCurrentPriorities) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enterEdit();
    }
  }

  async function handleDelete() {
    try {
      await deleteContext.mutateAsync(entryId);
      toast.success("Document deleted");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    }
  }

  function handleTogglePin() {
    if (!entry) return;
    const currentlyPinned = !!entry.isPinned;
    togglePin.mutate(
      { id: entryId, isPinned: !currentlyPinned },
      {
        onSuccess: () => {
          toast.success(currentlyPinned ? "Unpinned" : "Pinned");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update pin");
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Current priorities view
  if (isCurrentPriorities) {
    if (!cpData) {
      return (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          Could not load Current Priorities.
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-2 border-b p-4">
          {isMobileOverlay && (
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <ArrowLeftIcon className="size-4" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-amber-500" />
              <h2 className="text-lg font-serif font-semibold leading-tight">
                {cpData.title}
              </h2>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0">
                Dynamic · live
              </Badge>
            </div>
          </div>
          {!isMobileOverlay && (
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <XIcon className="size-4" />
            </Button>
          )}
        </div>

        {/* Content (read-only for the dynamic doc) */}
        <div className="flex-1 p-4">
          <div
            className="context-prose"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            onClick={handleContentClick}
          />
        </div>
      </div>
    );
  }

  // Regular entry view
  if (!entry) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Document not found.
      </div>
    );
  }

  const incomingLinks =
    (entry.incomingLinks as { id: string; title: string }[]) ?? [];
  const isPinned = !!entry.isPinned;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-2 border-b p-4">
        {isMobileOverlay && (
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <ArrowLeftIcon className="size-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isPinned && (
              <Pin className="size-3.5 shrink-0 text-amber-500 fill-amber-500" />
            )}
            <h2 className="text-lg font-serif font-semibold leading-tight truncate">
              {entry.title}
            </h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {entry.category && (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: entry.category.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {entry.category.name}
                </span>
              </div>
            )}
            {entry.tags?.map((tag: string) => (
              <button
                key={tag}
                type="button"
                onClick={() => setContextTagFilter(tag)}
                className="hover:underline"
                title={`Filter by #${tag}`}
              >
                <Badge
                  variant="secondary"
                  className="text-[0.65rem] px-1.5 py-0"
                >
                  #{tag}
                </Badge>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleTogglePin}
            title={isPinned ? "Unpin" : "Pin"}
            disabled={togglePin.isPending}
          >
            <Pin
              className={
                isPinned
                  ? "size-4 text-amber-500 fill-amber-500"
                  : "size-4"
              }
            />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Edit">
            <PencilIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteDialogOpen(true)}
            title="Delete"
          >
            <Trash2Icon className="size-4 text-destructive" />
          </Button>
          {!isMobileOverlay && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              title="Close"
            >
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-5 p-4">
        {isEditing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveDraft}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[400px] rounded-lg border border-border bg-background p-3 font-mono text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={handleContentClick}
            onKeyDown={handleContentKeyDown}
            className="context-prose cursor-text rounded-md py-2 hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}

        {incomingLinks.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Referenced in {incomingLinks.length}{" "}
                {incomingLinks.length === 1 ? "entry" : "entries"}
              </Label>
              <div className="space-y-1">
                {incomingLinks.map((link: { id: string; title: string }) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => onNavigate?.(link.id)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline w-full text-left"
                  >
                    <Link2 className="size-3.5 shrink-0" />
                    <span className="truncate">{link.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(o) => setDeleteDialogOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{entry.title}&rdquo; and
              remove all backlink references.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteContext.isPending}
            >
              {deleteContext.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
