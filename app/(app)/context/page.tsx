"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useContextEntries, useTogglePin } from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { ContextSearch } from "@/components/context/context-search";
import { ContextCategoryTree } from "@/components/context/context-category-tree";
import { ContextEntryList } from "@/components/context/context-entry-list";
import { ContextEntryDetail } from "@/components/context/context-entry-detail";
import { ContextEntryEditor } from "@/components/context/context-entry-editor";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface ContextEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  isPinned: boolean;
  category?: { id: string; name: string; color: string } | null;
}

export default function ContextPage() {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showCurrentPriorities, setShowCurrentPriorities] = useState(false);

  const contextFilters = useUIStore((s) => s.contextFilters);
  const setContextTagFilter = useUIStore((s) => s.setContextTagFilter);
  const tagFilter = contextFilters.tag ?? null;

  const { data: entries, isLoading } = useContextEntries(
    selectedCategoryId ? { categoryId: selectedCategoryId } : undefined,
  );

  const entryList = (entries ?? []) as ContextEntry[];

  const filteredEntries = useMemo(() => {
    if (!tagFilter) return entryList;
    return entryList.filter((entry) => entry.tags.includes(tagFilter));
  }, [entryList, tagFilter]);

  const hasCategoryFilter = selectedCategoryId !== null;

  const togglePin = useTogglePin();

  function handleTogglePin(id: string, currentlyPinned: boolean) {
    togglePin.mutate(
      { id, isPinned: !currentlyPinned },
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

  function handleClearTagFilter() {
    setContextTagFilter(null);
  }

  function handleSelectEntry(id: string) {
    setSelectedEntryId(id);
    setIsCreating(false);
    setEditingEntryId(null);
    setShowCurrentPriorities(false);
  }

  function handleSelectCurrentPriorities() {
    setShowCurrentPriorities(true);
    setSelectedEntryId(null);
    setIsCreating(false);
    setEditingEntryId(null);
  }

  function handleNewDocument() {
    setIsCreating(true);
    setSelectedEntryId(null);
    setEditingEntryId(null);
    setShowCurrentPriorities(false);
  }

  function handleSave(id: string) {
    setIsCreating(false);
    setEditingEntryId(null);
    setSelectedEntryId(id);
    setShowCurrentPriorities(false);
    toast.success("Document saved");
  }

  function handleCancelEdit() {
    setIsCreating(false);
    setEditingEntryId(null);
  }

  function handleEdit() {
    if (selectedEntryId) {
      setEditingEntryId(selectedEntryId);
      setIsCreating(false);
    }
  }

  function handleDetailClose() {
    setSelectedEntryId(null);
    setShowCurrentPriorities(false);
    setEditingEntryId(null);
  }

  function handleSearchSelect(id: string) {
    handleSelectEntry(id);
  }

  const showDetail = selectedEntryId || showCurrentPriorities;
  const showEditor = isCreating || editingEntryId;

  return (
    <div className="flex h-full">
      {/* Left panel: Entry list */}
      <div
        className={`flex-1 flex flex-col border-r overflow-y-auto ${
          showDetail || showEditor ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-background p-4 space-y-3">
          {/* Row 1: Title + New button */}
          <PageHeader
            title="Context"
            className="mb-0"
            actions={
              <Button size="sm" onClick={handleNewDocument} className="gap-1.5">
                <Plus className="size-3.5" />
                New
              </Button>
            }
          />

          {/* Row 2: Search */}
          <ContextSearch onSelect={handleSearchSelect} />

          {/* Row 3: Category tree (collapsible) */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors py-1">
              Categories
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1">
                <ContextCategoryTree
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={setSelectedCategoryId}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Entry list */}
        <ContextEntryList
          entries={filteredEntries}
          selectedId={selectedEntryId}
          onSelect={handleSelectEntry}
          isLoading={isLoading}
          currentPrioritiesSelected={showCurrentPriorities}
          onSelectCurrentPriorities={handleSelectCurrentPriorities}
          hasCategoryFilter={hasCategoryFilter}
          tagFilter={tagFilter}
          onClearTagFilter={handleClearTagFilter}
          onTagClick={setContextTagFilter}
          onTogglePin={handleTogglePin}
        />
      </div>

      {/* Right panel: Detail / Editor / Empty */}
      {showEditor ? (
        <>
          {/* Desktop */}
          <div className="hidden md:flex w-[400px] lg:w-[440px] flex-col border-l">
            <ContextEntryEditor
              entryId={editingEntryId ?? undefined}
              onSave={handleSave}
              onCancel={handleCancelEdit}
            />
          </div>
          {/* Mobile overlay */}
          <div className="flex md:hidden fixed inset-0 z-40 bg-background">
            <ContextEntryEditor
              entryId={editingEntryId ?? undefined}
              onSave={handleSave}
              onCancel={handleCancelEdit}
            />
          </div>
        </>
      ) : showDetail ? (
        <>
          {/* Desktop */}
          <div className="hidden md:flex w-[400px] lg:w-[440px] flex-col border-l">
            {showCurrentPriorities ? (
              <ContextEntryDetail
                entryId="__current_priorities__"
                onClose={handleDetailClose}
                onEdit={() => {}}
                onNavigate={handleSelectEntry}
              />
            ) : (
              <ContextEntryDetail
                entryId={selectedEntryId!}
                onClose={handleDetailClose}
                onEdit={handleEdit}
                onNavigate={handleSelectEntry}
              />
            )}
          </div>
          {/* Mobile overlay */}
          <div className="flex md:hidden fixed inset-0 z-40 bg-background">
            {showCurrentPriorities ? (
              <ContextEntryDetail
                entryId="__current_priorities__"
                onClose={handleDetailClose}
                onEdit={() => {}}
                onNavigate={handleSelectEntry}
                isMobileOverlay
              />
            ) : (
              <ContextEntryDetail
                entryId={selectedEntryId!}
                onClose={handleDetailClose}
                onEdit={handleEdit}
                onNavigate={handleSelectEntry}
                isMobileOverlay
              />
            )}
          </div>
        </>
      ) : (
        <div className="hidden md:flex w-[400px] lg:w-[440px] items-center justify-center text-muted-foreground border-l">
          <p className="text-sm">Select a document to view</p>
        </div>
      )}
    </div>
  );
}
