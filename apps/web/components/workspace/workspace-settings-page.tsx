"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/ui/page-header";
import { MemberList } from "@/components/workspace/member-list";
import { useMe } from "@/lib/hooks/use-me";
import {
  useWorkspace,
  useUpdateWorkspace,
} from "@/lib/hooks/use-workspaces";

/**
 * Workspace settings page component.
 *
 * Composed of three cards:
 * 1. General: inline-edit workspace name
 * 2. Members: member list table
 * 3. Danger: disabled delete button
 */
export function WorkspaceSettingsPage() {
  const me = useMe();
  const workspaceId = me.data?.workspaceId ?? null;
  const workspace = useWorkspace(workspaceId);

  // Workspace not yet resolved: show skeleton cards
  if (!workspaceId || workspace.isPending) {
    return (
      <div>
        <PageHeader
          title="Workspace"
          subtitle="Manage your workspace name and members."
        />
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Workspace"
        subtitle="Manage your workspace name and members."
      />
      <div className="max-w-2xl space-y-6">
        {/* General settings */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkspaceNameEditor
              workspaceId={workspaceId}
              currentName={workspace.data?.name ?? ""}
            />
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberList workspaceId={workspaceId} />
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete workspace</p>
                <p className="text-xs text-muted-foreground">
                  Permanently removes the workspace and all its data. This
                  action cannot be undone.
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled
                        aria-label="Delete workspace"
                      />
                    }
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </TooltipTrigger>
                  <TooltipContent>
                    Sole workspace cannot be deleted in Wave 8.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceNameEditor: inline click-to-edit for the workspace name
// ---------------------------------------------------------------------------

function WorkspaceNameEditor({
  workspaceId,
  currentName,
}: {
  workspaceId: string;
  currentName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const updateWorkspace = useUpdateWorkspace();

  // Sync local state when the prop changes (e.g. after refetch)
  if (!editing && name !== currentName) {
    setName(currentName);
  }

  function handleStartEditing() {
    setName(currentName);
    setEditing(true);
  }

  function handleCancel() {
    setName(currentName);
    setEditing(false);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Workspace name cannot be empty.");
      return;
    }
    if (trimmed === currentName) {
      setEditing(false);
      return;
    }

    try {
      await updateWorkspace.mutateAsync({
        id: workspaceId,
        input: { name: trimmed },
      });
      toast.success("Workspace name updated.");
      setEditing(false);
    } catch {
      // Error toast is handled by the mutation's onError callback
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <Label htmlFor="workspace-name" className="text-sm">
          Workspace name
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={100}
            autoFocus
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={updateWorkspace.isPending}
            aria-label="Save workspace name"
          >
            <Check className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={updateWorkspace.isPending}
            aria-label="Cancel editing"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">Workspace name</Label>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm">{currentName}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleStartEditing}
          aria-label="Edit workspace name"
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    </div>
  );
}
