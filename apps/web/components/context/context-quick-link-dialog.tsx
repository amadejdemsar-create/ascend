"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import {
  CONTEXT_LINK_TYPE_VALUES,
  type ContextLinkType,
} from "@ascend/core";
import { edgeColor } from "@ascend/graph";
import {
  useContextEntries,
  useCreateContextLink,
  useContextEntry,
} from "@/lib/hooks/use-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LINK_TYPE_LABELS } from "@/components/context/context-edges-panel";

// ── Types ─────────────────────────────────────────────────────────

interface ContextQuickLinkDialogProps {
  fromEntryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EntryOption {
  id: string;
  title: string;
}

// ── Component ─────────────────────────────────────────────────────

export function ContextQuickLinkDialog({
  fromEntryId,
  open,
  onOpenChange,
}: ContextQuickLinkDialogProps) {
  const [selectedType, setSelectedType] = useState<ContextLinkType>("REFERENCES");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: allEntries } = useContextEntries();
  const { data: currentEntryRaw } = useContextEntry(fromEntryId);
  const createLink = useCreateContextLink();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentEntry = currentEntryRaw as Record<string, any> | undefined;

  // Build the list of already-linked entry ids for the current type to filter
  // out duplicates.
  const existingLinkTargets = useMemo(() => {
    if (!currentEntry) return new Set<string>();
    const outgoing = (currentEntry.outgoingLinks ?? []) as Array<{
      toEntryId: string;
      type: string;
    }>;
    return new Set(
      outgoing
        .filter((l) => l.type === selectedType)
        .map((l) => l.toEntryId),
    );
  }, [currentEntry, selectedType]);

  // Available target entries: exclude self and already-linked entries of the
  // same type.
  const availableEntries = useMemo(() => {
    const list = (allEntries ?? []) as EntryOption[];
    return list.filter(
      (e) => e.id !== fromEntryId && !existingLinkTargets.has(e.id),
    );
  }, [allEntries, fromEntryId, existingLinkTargets]);

  const selectedEntry = availableEntries.find((e) => e.id === selectedTargetId);

  function handleCreate() {
    if (!selectedTargetId) return;
    createLink.mutate(
      {
        fromEntryId,
        toEntryId: selectedTargetId,
        type: selectedType,
        source: "MANUAL",
      },
      {
        onSuccess: () => {
          toast.success("Link created");
          // Reset and close
          setSelectedTargetId(null);
          setSearch("");
          setSelectedType("REFERENCES");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to create link",
          );
        },
      },
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Reset state when closing
      setSelectedTargetId(null);
      setSearch("");
      setSelectedType("REFERENCES");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Link</DialogTitle>
          <DialogDescription>
            Create a manual link from this entry to another.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Link type picker */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-link-type" className="text-xs">
              Link type
            </Label>
            <Select
              value={selectedType}
              onValueChange={(val) => {
                setSelectedType(val as ContextLinkType);
                // Clear target when type changes since filters change
                setSelectedTargetId(null);
              }}
            >
              <SelectTrigger
                id="quick-link-type"
                aria-label="Link type"
                className="w-full"
              >
                <SelectValue>
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ backgroundColor: edgeColor(selectedType) }}
                    aria-hidden="true"
                  />
                  <span>{LINK_TYPE_LABELS[selectedType]}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTEXT_LINK_TYPE_VALUES.map((lt) => (
                  <SelectItem key={lt} value={lt}>
                    <span
                      className="inline-block size-2 rounded-full shrink-0"
                      style={{ backgroundColor: edgeColor(lt) }}
                      aria-hidden="true"
                    />
                    <span>{LINK_TYPE_LABELS[lt]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target entry picker (combobox via Command) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Target entry</Label>
            <div className="rounded-lg border">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search entries..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  <CommandEmpty>No matching entries.</CommandEmpty>
                  <CommandGroup>
                    {availableEntries
                      .filter((e) =>
                        e.title.toLowerCase().includes(search.toLowerCase()),
                      )
                      .slice(0, 20)
                      .map((entry) => (
                        <CommandItem
                          key={entry.id}
                          value={entry.id}
                          onSelect={() => setSelectedTargetId(entry.id)}
                          data-checked={selectedTargetId === entry.id}
                        >
                          <Link2
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate">{entry.title}</span>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
            {selectedEntry && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedEntry.title}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!selectedTargetId || createLink.isPending}
            className="gap-1.5"
          >
            <Link2 className="size-3.5" aria-hidden="true" />
            {createLink.isPending ? "Creating..." : "Create link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
