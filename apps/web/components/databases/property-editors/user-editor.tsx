"use client";

import { useState } from "react";
import { ChevronDownIcon, UserIcon, XIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface UserInfo {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

interface UserEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "USER" }> };
  value: string | null; // userId
  onChange: (next: string | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Current user info provided by the parent. Required for display. */
  currentUser?: UserInfo;
  /** Available users for selection. For single-user mode, this is just the current user. */
  availableUsers?: UserInfo[];
}

// ── Component ─────────────────────────────────────────────────────────────

export function UserEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
  autoFocus,
  currentUser,
  availableUsers,
}: UserEditorProps) {
  const [open, setOpen] = useState(autoFocus ?? false);

  // Build user list: fall back to just currentUser if availableUsers not provided
  const users: UserInfo[] = availableUsers ?? (currentUser ? [currentUser] : []);
  const selectedUser = users.find((u) => u.id === value);

  function handleSelect(userId: string) {
    if (userId === value) {
      onChange(null);
    } else {
      onChange(userId);
    }
    setOpen(false);
  }

  // ── Avatar component ──────────────────────────────────────────────────

  function UserAvatar({ user, size = "sm" }: { user: UserInfo; size?: "sm" | "md" }) {
    const sizeClass = size === "sm" ? "size-5" : "size-6";
    if (user.avatarUrl) {
      return (
        <img
          src={user.avatarUrl}
          alt=""
          className={cn(sizeClass, "rounded-full object-cover")}
          aria-hidden="true"
        />
      );
    }
    return (
      <span
        className={cn(
          sizeClass,
          "flex items-center justify-center rounded-full bg-primary/10 text-primary",
        )}
        aria-hidden="true"
      >
        <UserIcon className={size === "sm" ? "size-3" : "size-3.5"} />
      </span>
    );
  }

  // ── Dropdown content ──────────────────────────────────────────────────

  const dropdownContent = (
    <div className="flex flex-col gap-1 p-1">
      {users.length === 0 && (
        <p className="text-xs text-muted-foreground px-2 py-1">No users available.</p>
      )}
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          onClick={() => handleSelect(user.id)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left w-full",
            "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            user.id === value && "bg-accent",
          )}
          aria-label={user.name}
          aria-selected={user.id === value}
          role="option"
        >
          <UserAvatar user={user} size="sm" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm truncate">{user.name}</span>
            {user.email && (
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            )}
          </div>
        </button>
      ))}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent w-full transition-colors border-t mt-1 pt-1.5"
          aria-label="Clear user"
        >
          <XIcon className="size-3" aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  );

  // ── Expanded mode ─────────────────────────────────────────────────────

  if (mode === "expanded") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-label={`Select user for ${field.name}`}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2">
              <UserAvatar user={selectedUser} size="md" />
              <span className="truncate">{selectedUser.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select user...</span>
          )}
          <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {dropdownContent}
        </PopoverContent>
      </Popover>
    );
  }

  // ── Cell mode ─────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "w-full text-left rounded px-1.5 py-1 transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label={`Edit ${field.name}`}
      >
        {selectedUser ? (
          <div className="flex items-center gap-1.5">
            <UserAvatar user={selectedUser} size="sm" />
            <span className="text-sm truncate">{selectedUser.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">&mdash;</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {dropdownContent}
      </PopoverContent>
    </Popover>
  );
}
