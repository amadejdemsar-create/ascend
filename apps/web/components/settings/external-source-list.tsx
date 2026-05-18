"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  useDeleteExternalSource,
  useExternalSources,
  useRefreshExternalSchema,
  useUpdateExternalSource,
  type ExternalSource,
} from "@/lib/hooks/use-external-data";
import { ExternalSourceFormDialog } from "./external-source-form-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const PROVIDER_LABEL: Record<string, string> = {
  GITHUB: "GitHub",
};

export function ExternalSourceList() {
  const { data: sources, isLoading } = useExternalSources();
  const update = useUpdateExternalSource();
  const refreshSchema = useRefreshExternalSchema();
  const remove = useDeleteExternalSource();

  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ExternalSource | null>(
    null,
  );

  async function handleToggle(source: ExternalSource, next: boolean) {
    try {
      await update.mutateAsync({ id: source.id, input: { enabled: next } });
    } catch {
      /* hook toasts */
    }
  }

  async function handleRefresh(source: ExternalSource) {
    try {
      await refreshSchema.mutateAsync(source.id);
      toast.success(`${source.name}: schema refreshed.`);
    } catch {
      /* hook toasts */
    }
  }

  async function handleDelete(source: ExternalSource) {
    try {
      await remove.mutateAsync(source.id);
      toast.success(`"${source.name}" disconnected.`);
      setConfirmDelete(null);
    } catch {
      /* hook toasts */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
          Add integration
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && sources && sources.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No integrations yet. Connect GitHub to see Issues and PRs as a
          virtual database inside Ascend.
        </div>
      )}

      {!isLoading && sources && sources.length > 0 && (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li
              key={source.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Plug className="size-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{source.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {PROVIDER_LABEL[source.provider] ?? source.provider}
                  </Badge>
                  {source.lastRefreshError && (
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-destructive"
                      title={source.lastRefreshError}
                    >
                      Error
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {source.lastRefreshedAt
                    ? `Schema refreshed ${formatDistanceToNow(new Date(source.lastRefreshedAt), { addSuffix: true })}`
                    : "Schema not yet refreshed"}
                </div>
                {source.contextEntryId && (
                  <Link
                    href={`/context`}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open virtual database
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Switch
                  checked={source.enabled}
                  onCheckedChange={(v) => handleToggle(source, v)}
                  aria-label={source.enabled ? "Disable source" : "Enable source"}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRefresh(source)}
                  disabled={refreshSchema.isPending}
                  title="Refresh schema"
                >
                  <RefreshCw
                    className={`size-4 ${refreshSchema.isPending ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(source)}
                  title="Disconnect"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ExternalSourceFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect &ldquo;{confirmDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The virtual database disappears from /context. Stored
              credentials are wiped. Your GitHub data is not modified;
              this only removes the connection from Ascend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) void handleDelete(confirmDelete);
              }}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
