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
} from "lucide-react";
import { useContextEntry, useDeleteContext } from "@/lib/hooks/use-context";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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

  const entry = entryRaw as EntryData | undefined;
  const deleteContext = useDeleteContext();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isLoading = isCurrentPriorities ? cpLoading : entryLoading;

  // Render markdown content with [[wikilinks]] transformed to clickable links
  const renderedHtml = useMemo(() => {
    const rawContent = isCurrentPriorities
      ? cpData?.content ?? ""
      : entry?.content ?? "";

    // Replace [[Title]] with clickable span elements
    const processedContent = rawContent.replace(
      /\[\[([^\]]+)\]\]/g,
      '<a class="context-wikilink" data-link-title="$1">$1</a>',
    );

    return marked.parse(processedContent, { async: false }) as string;
  }, [isCurrentPriorities, cpData, entry]);

  function handleWikilinkClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains("context-wikilink") && onNavigate) {
      const title = target.getAttribute("data-link-title");
      if (title) {
        // Find the linked entry by searching incoming/outgoing links
        // For now, the link is informational; navigation requires entry ID
        toast.info(`Link: ${title}`);
      }
    }
  }

  async function handleDelete() {
    try {
      await deleteContext.mutateAsync(entryId);
      toast.success("Document deleted");
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    }
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
            <div className="mt-1">
              <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0">
                Auto-generated
              </Badge>
            </div>
          </div>
          {!isMobileOverlay && (
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <XIcon className="size-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          <div
            className="context-prose"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            onClick={handleWikilinkClick}
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
          <h2 className="text-lg font-serif font-semibold leading-tight">
            {entry.title}
          </h2>
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
              <Badge
                key={tag}
                variant="secondary"
                className="text-[0.65rem] px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            title="Edit"
          >
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
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close">
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-5 p-4">
        <div
          className="context-prose"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
          onClick={handleWikilinkClick}
        />

        <Separator />

        {/* Backlinks */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Link2 className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Linked from
            </span>
          </div>
          {incomingLinks.length > 0 ? (
            <div className="space-y-1">
              {incomingLinks.map(
                (link: { id: string; title: string }) => (
                  <button
                    key={link.id}
                    onClick={() => onNavigate?.(link.id)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline w-full text-left"
                  >
                    <span className="truncate">{link.title}</span>
                  </button>
                ),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No incoming links</p>
          )}
        </div>
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
