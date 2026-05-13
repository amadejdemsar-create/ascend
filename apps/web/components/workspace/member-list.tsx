"use client";

import { UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspaceMembers } from "@/lib/hooks/use-workspaces";
import { getUserColor } from "@/lib/realtime/awareness-color";

interface MemberListProps {
  workspaceId: string | null;
}

/**
 * Displays workspace members in a simple table.
 *
 * Columns: Member (avatar + name + email), Role, Joined.
 * Includes a disabled "Invite member" button until invitations ship.
 */
export function MemberList({ workspaceId }: MemberListProps) {
  const members = useWorkspaceMembers(workspaceId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {members.data
            ? `${members.data.length} member${members.data.length !== 1 ? "s" : ""}`
            : "Members"}
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  aria-label="Invite member"
                />
              }
            >
              <UserPlus className="mr-2 size-4" />
              Invite
            </TooltipTrigger>
            <TooltipContent>Invitations are not yet available</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {members.isPending && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {members.data && members.data.length === 0 && (
        (() => {
          console.warn(
            "MemberList: workspace has zero members. This should never happen; every workspace has at least the owner.",
          );
          return (
            <p className="text-sm text-muted-foreground">No members found.</p>
          );
        })()
      )}

      {members.data && members.data.length > 0 && (
        <div className="divide-y rounded-md border">
          {members.data.map((member) => {
            const displayEmail = member.email ?? "";
            const initials = getInitials(member.displayName, displayEmail);
            const color = getUserColor(member.userId);

            return (
              <div
                key={member.userId}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Avatar */}
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                >
                  {initials}
                </div>

                {/* Name + email */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.displayName ?? (displayEmail || "Unknown")}
                  </p>
                  {member.displayName && displayEmail && (
                    <p className="truncate text-xs text-muted-foreground">
                      {displayEmail}
                    </p>
                  )}
                </div>

                {/* Role */}
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {formatRole(member.role)}
                </span>

                {/* Joined */}
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {formatDistanceToNow(new Date(member.joinedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Extract up to two initials from a name or email.
 */
function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  // Fall back to email local part
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase();
}

/**
 * Format a WorkspaceRole for display.
 */
function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}
