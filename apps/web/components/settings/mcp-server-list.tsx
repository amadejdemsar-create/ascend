"use client";

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
import {
  CheckCircle2,
  CircleAlert,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  useDeleteMcpServer,
  useMcpServers,
  useTestMcpServer,
  useUpdateMcpServer,
  type McpConnection,
} from "@/lib/hooks/use-mcp-servers";
import { McpServerFormDialog } from "./mcp-server-form-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

/**
 * Settings list of MCP server connections. Each row supports inline
 * test, enable toggle, edit, and delete. Add via "+ Add server" at
 * the top.
 */
export function McpServerList() {
  const { data: connections, isLoading } = useMcpServers();
  const update = useUpdateMcpServer();
  const test = useTestMcpServer();
  const remove = useDeleteMcpServer();

  const [editing, setEditing] = useState<McpConnection | null | undefined>(
    undefined,
  ); // undefined = closed; null = new; row = edit
  const [confirmDelete, setConfirmDelete] = useState<McpConnection | null>(
    null,
  );

  async function handleToggle(conn: McpConnection, next: boolean) {
    try {
      await update.mutateAsync({
        id: conn.id,
        input: { enabled: next },
      });
    } catch {
      /* hook toasts on error */
    }
  }

  async function handleTest(conn: McpConnection) {
    try {
      const res = await test.mutateAsync(conn.id);
      if (res.healthy) {
        toast.success(
          `${conn.name}: healthy (${res.toolCount ?? 0} tool${res.toolCount === 1 ? "" : "s"})`,
        );
      } else {
        toast.error(
          `${conn.name}: ${res.error ?? "test failed (no details)"}`,
        );
      }
    } catch {
      /* hook toasts on error */
    }
  }

  async function handleDelete(conn: McpConnection) {
    try {
      await remove.mutateAsync(conn.id);
      toast.success(`"${conn.name}" removed.`);
      setConfirmDelete(null);
    } catch {
      /* hook toasts on error */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button onClick={() => setEditing(null)} size="sm">
          <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
          Add server
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && connections && connections.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No MCP servers connected yet. Add one to expose its tools to
          your AI clients.
        </div>
      )}

      {!isLoading && connections && connections.length > 0 && (
        <ul className="space-y-2">
          {connections.map((conn) => (
            <li
              key={conn.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{conn.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {conn.slug}
                  </Badge>
                  {conn.lastListedAt && !conn.lastListError && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    >
                      <CheckCircle2
                        className="mr-1 size-3"
                        aria-hidden="true"
                      />
                      Healthy
                      {typeof conn.toolCount === "number"
                        ? ` • ${conn.toolCount} tool${conn.toolCount === 1 ? "" : "s"}`
                        : ""}
                    </Badge>
                  )}
                  {conn.lastListError && (
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-destructive"
                      title={conn.lastListError}
                    >
                      <CircleAlert
                        className="mr-1 size-3"
                        aria-hidden="true"
                      />
                      Error
                    </Badge>
                  )}
                  {!conn.lastListedAt && !conn.lastListError && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Never tested
                    </Badge>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {conn.endpoint}
                  <span className="ml-2">
                    {conn.transport === "HTTP_STREAMABLE"
                      ? "HTTP"
                      : "SSE"}
                    {conn.authType !== "NONE" && (
                      <>
                        {" "}
                        · {conn.authType === "API_KEY" ? "API key" : "Bearer"}
                      </>
                    )}
                  </span>
                </div>
                {conn.lastListedAt && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Last tested{" "}
                    {formatDistanceToNow(new Date(conn.lastListedAt), {
                      addSuffix: true,
                    })}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Switch
                  checked={conn.enabled}
                  onCheckedChange={(v) => handleToggle(conn, v)}
                  aria-label={
                    conn.enabled ? "Disable connection" : "Enable connection"
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTest(conn)}
                  disabled={test.isPending}
                  title="Test connection"
                >
                  <RefreshCw
                    className={`size-4 ${test.isPending ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(conn)}
                  title="Edit"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(conn)}
                  title="Remove"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <McpServerFormDialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        existing={editing ?? undefined}
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
              Remove &ldquo;{confirmDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The server&apos;s tools will stop appearing in your AI
              clients. Stored credentials are wiped. This does not delete
              anything on the upstream server.
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
              {remove.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
