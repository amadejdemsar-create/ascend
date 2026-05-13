"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/hooks/use-me";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";

/**
 * Workspace switcher dropdown for the sidebar header.
 *
 * Shows the current workspace name with a chevron. The dropdown lists
 * all workspaces the user belongs to (one in Wave 8) and a link to
 * workspace settings.
 *
 * In Wave 8, switching workspaces is disabled since each user has
 * exactly one workspace. Workspace items other than the current one
 * are visually muted.
 */
export function WorkspaceSwitcher() {
  const me = useMe();
  const workspaces = useWorkspaces();

  const currentWorkspaceId = me.data?.workspaceId ?? null;
  const workspaceList = workspaces.data ?? [];

  // Find the current workspace in the list
  const currentWorkspace = workspaceList.find(
    (w) => w.id === currentWorkspaceId,
  );
  const displayName = currentWorkspace?.name ?? "Personal";

  // Loading state: show skeleton without dropdown
  if (me.isPending || workspaces.isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Skeleton className="size-4" />
            </div>
            <Skeleton className="h-4 w-24" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // Error or no workspaces: show fallback text without dropdown
  if (workspaces.isError || workspaceList.length === 0) {
    if (workspaces.isError) {
      console.error(
        "Failed to load workspaces:",
        workspaces.error?.message,
      );
    }
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="text-xs font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="truncate text-sm font-medium">{displayName}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={`Current workspace: ${displayName}. Click to switch or manage.`}
              />
            }
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="text-xs font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="truncate text-sm font-medium">
              {displayName}
            </span>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel>
              Switch workspace
            </DropdownMenuLabel>

            <DropdownMenuGroup>
              {workspaceList.map((workspace) => {
                const isCurrent = workspace.id === currentWorkspaceId;
                return (
                  <DropdownMenuItem
                    key={workspace.id}
                    className="gap-2"
                    disabled={isCurrent}
                    onClick={(e) => {
                      if (!isCurrent) {
                        // Wave 8b: would trigger workspace switch here
                        e.preventDefault();
                      }
                    }}
                  >
                    <div className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary">
                      <span className="text-[10px] font-semibold">
                        {workspace.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate">{workspace.name}</span>
                    {isCurrent && (
                      <Check className="ml-auto size-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              render={<Link href="/settings/workspace" />}
              className="gap-2"
            >
              <Settings className="size-4" />
              <span>Workspace settings</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
