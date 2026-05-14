"use client";

import { useState } from "react";
import {
  ChevronDown,
  Check,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  useCanvasLayouts,
  useCreateLayout,
  type CanvasLayoutListItem,
} from "@/lib/hooks/use-canvas";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import { CanvasLayoutRenameDialog } from "./canvas-layout-rename-dialog";
import { CanvasLayoutDeleteDialog } from "./canvas-layout-delete-dialog";

interface Props {
  activeLayoutId: string | null;
  activeLayoutName: string;
}

/**
 * Wave 9 Phase 7: top-left toolbar dropdown that lists every layout
 * the user owns in the current workspace. Click a row to switch
 * (persists via useUIStore.canvasActiveLayoutId). "+ New layout"
 * creates an empty layout inline.
 *
 * Each row has a kebab menu with Rename + Delete actions.
 */
export function CanvasLayoutSwitcher({ activeLayoutId, activeLayoutName }: Props) {
  const setActiveLayoutId = useUIStore((s) => s.setCanvasActiveLayoutId);
  const { data: layouts, isLoading } = useCanvasLayouts();
  const createLayout = useCreateLayout();
  const [open, setOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CanvasLayoutListItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<CanvasLayoutListItem | null>(
    null,
  );

  function handleCreate() {
    const name = `Layout ${new Date().toLocaleDateString("en-GB")}`;
    createLayout.mutate(
      { name },
      {
        onSuccess: (result) => {
          if (result.layout?.id) {
            setActiveLayoutId(result.layout.id);
          }
          setOpen(false);
        },
      },
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              variant="outline"
              className="max-w-[220px] gap-1.5"
            />
          }
        >
          <span className="truncate font-medium">{activeLayoutName}</span>
          <ChevronDown
            className="size-3.5 shrink-0 opacity-60"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[260px]">
          {isLoading && (
            <DropdownMenuItem disabled>Loading layouts...</DropdownMenuItem>
          )}
          {!isLoading && (!layouts || layouts.length === 0) && (
            <DropdownMenuItem disabled>No layouts yet</DropdownMenuItem>
          )}
          {layouts?.map((layout) => {
            const isActive = layout.id === activeLayoutId;
            return (
              <div
                key={layout.id}
                className={cn(
                  "flex items-center gap-1 rounded-sm px-1 py-0.5",
                  isActive && "bg-accent/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveLayoutId(layout.id);
                    setOpen(false);
                  }}
                  className="flex flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent/60"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="flex-1 truncate">{layout.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {layout._count.nodes}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${layout.name} options`}
                      />
                    }
                  >
                    <MoreVertical className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameTarget(layout);
                        setOpen(false);
                      }}
                    >
                      <Pencil className="mr-2 size-3.5" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setDeleteTarget(layout);
                        setOpen(false);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            disabled={createLayout.isPending}
          >
            <Plus className="mr-2 size-3.5" />
            {createLayout.isPending ? "Creating..." : "New layout"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {renameTarget && (
        <CanvasLayoutRenameDialog
          layout={renameTarget}
          open={renameTarget !== null}
          onOpenChange={(o) => {
            if (!o) setRenameTarget(null);
          }}
        />
      )}
      {deleteTarget && (
        <CanvasLayoutDeleteDialog
          layout={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(o) => {
            if (!o) setDeleteTarget(null);
          }}
          onDeleted={(deletedId) => {
            // If we just deleted the active layout, fall back to null
            // so useDefaultCanvasLayout picks (or creates) the next one.
            if (deletedId === activeLayoutId) {
              setActiveLayoutId(null);
            }
          }}
        />
      )}
    </>
  );
}
