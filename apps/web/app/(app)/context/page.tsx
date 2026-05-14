"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelectionSync } from "@/lib/hooks/use-selection-sync";
import { toast } from "sonner";
import { Plus, Upload, FileText, Database } from "lucide-react";
import { useUploadFile } from "@/lib/hooks/use-files";
import { useCreateDatabase } from "@/lib/hooks/use-databases";
import { useContextEntries, useTogglePin } from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { ContextSearch } from "@/components/context/context-search";
import { ContextCategoryTree } from "@/components/context/context-category-tree";
import { ContextEntryList } from "@/components/context/context-entry-list";
import { ContextEntryDetail } from "@/components/context/context-entry-detail";
import { ContextEntryEditor } from "@/components/context/context-entry-editor";
import { ContextViewSwitcher } from "@/components/context/context-view-switcher";
import type { ContextEntryType } from "@ascend/core";
import { ContextGraphView } from "@/components/context/context-graph-view";
import { ContextBacklinksView } from "@/components/context/context-backlinks-view";
import { ContextCanvasView } from "@/components/context/canvas";
import { ContextMapCard, ContextMapFilterPill } from "@/components/context/context-map-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  type?: ContextEntryType;
  category?: { id: string; name: string; color: string } | null;
}

export default function ContextPage() {
  return (
    <Suspense>
      <ContextPageInner />
    </Suspense>
  );
}

function ContextPageInner() {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  useSelectionSync({ selectedId: selectedEntryId, setSelectedId: setSelectedEntryId });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showCurrentPriorities, setShowCurrentPriorities] = useState(false);
  const [mapFilterEntryIds, setMapFilterEntryIds] = useState<string[] | null>(
    null,
  );

  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useUploadFile();
  const createDatabase = useCreateDatabase();

  const contextFilters = useUIStore((s) => s.contextFilters);
  const setContextTagFilter = useUIStore((s) => s.setContextTagFilter);
  const contextActiveView = useUIStore((s) => s.contextActiveView);
  const tagFilter = contextFilters.tag ?? null;

  const { data: entries, isLoading } = useContextEntries(
    selectedCategoryId ? { categoryId: selectedCategoryId } : undefined,
  );

  const entryList = (entries ?? []) as ContextEntry[];

  const filteredEntries = useMemo(() => {
    let list = entryList;
    if (tagFilter) {
      list = list.filter((entry) => entry.tags.includes(tagFilter));
    }
    // Apply map filter if active
    if (mapFilterEntryIds) {
      const idSet = new Set(mapFilterEntryIds);
      list = list.filter((entry) => idSet.has(entry.id));
    }
    return list;
  }, [entryList, tagFilter, mapFilterEntryIds]);

  const pinnedEntries = useMemo(() => {
    return filteredEntries.filter((entry) => entry.isPinned);
  }, [filteredEntries]);

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

  async function handleNewDatabase() {
    try {
      const result = await createDatabase.mutateAsync({ name: "Untitled Database" });
      // The response from the service has { database, fields, views, contextEntry }
      // The hook types it as DatabaseResponse which has entryId, but the raw response
      // may have contextEntry.id or database.contextEntryId. Handle both.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = result as any;
      const entryId = raw.entryId ?? raw.contextEntry?.id ?? raw.database?.contextEntryId;
      if (entryId) {
        handleSelectEntry(entryId);
      }
      toast.success("Database created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create database");
    }
  }

  function handleUploadClick() {
    uploadFileInputRef.current?.click();
  }

  function handleUploadFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const count = files.length;
    toast.success(`Uploading ${count} file(s)…`);

    for (let i = 0; i < files.length; i++) {
      uploadFile.mutate({ file: files[i], createEntry: true });
    }

    // Reset so picking the same file(s) again triggers onChange
    e.target.value = "";
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

  const handleClearMapFilter = useCallback(() => {
    setMapFilterEntryIds(null);
  }, []);

  // Listen for graph node selections (dispatched from ContextGraphView)
  useEffect(() => {
    function handleGraphNodeSelect(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id) {
        handleSelectEntry(detail.id);
      }
    }
    window.addEventListener(
      "ascend:context-node-select",
      handleGraphNodeSelect,
    );
    return () =>
      window.removeEventListener(
        "ascend:context-node-select",
        handleGraphNodeSelect,
      );
  }, []);

  // Listen for map filter events (dispatched from ContextMapCard items)
  useEffect(() => {
    function handleMapFilter(e: Event) {
      const detail = (e as CustomEvent<{ entryIds: string[] }>).detail;
      if (detail?.entryIds && detail.entryIds.length > 0) {
        setMapFilterEntryIds(detail.entryIds);
      }
    }
    window.addEventListener("ascend:context-filter", handleMapFilter);
    return () =>
      window.removeEventListener("ascend:context-filter", handleMapFilter);
  }, []);

  const showDetail = selectedEntryId || showCurrentPriorities;
  const showEditor = isCreating || editingEntryId;

  // Reusable "New" dropdown button for the toolbar
  function NewButton() {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" className="gap-1.5" />
          }
        >
          <Plus className="size-3.5" />
          New
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleNewDocument} className="gap-2">
            <FileText className="size-4" />
            Note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewDatabase} className="gap-2">
            <Database className="size-4" />
            Database
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // For graph view, the left panel is replaced by the graph canvas.
  // For canvas view (Wave 9 Map), same full-bleed treatment.
  // For pinned view, the left panel shows only pinned entries.
  // For backlinks view, placeholder for now.
  const isGraphView = contextActiveView === "graph";
  const isCanvasView = contextActiveView === "canvas";
  const isFullBleedView = isGraphView || isCanvasView;

  // Escape closes the open detail/editor panel. Scoped to this page because
  // the global handler only owns selectedGoalId. Skips when focus is in a
  // text field so users can dismiss autocomplete/clear values as expected.
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (showEditor) {
        e.preventDefault();
        handleCancelEdit();
        return;
      }
      if (showDetail) {
        e.preventDefault();
        handleDetailClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showDetail, showEditor]);

  // ── Render the left panel content based on active view ─────────

  function renderLeftPanelContent() {
    switch (contextActiveView) {
      case "graph":
        return <ContextGraphView />;

      case "canvas":
        return <ContextCanvasView />;

      case "pinned":
        return (
          <>
            {/* Header for pinned view */}
            <div className="sticky top-0 z-10 border-b bg-background p-4 space-y-3">
              <PageHeader
                title="Context"
                className="mb-0"
                actions={
                  <>
                    <ContextViewSwitcher />
                    <Button size="sm" variant="outline" onClick={handleUploadClick} className="gap-1.5">
                      <Upload className="size-3.5" />
                      Upload
                    </Button>
                    <NewButton />
                  </>
                }
              />
              <ContextSearch onSelect={handleSearchSelect} />
            </div>
            <div className="p-4">
              <ContextMapCard />
              {mapFilterEntryIds && (
                <div className="mb-3">
                  <ContextMapFilterPill onClear={handleClearMapFilter} />
                </div>
              )}
            </div>
            <ContextEntryList
              entries={pinnedEntries}
              selectedId={selectedEntryId}
              onSelect={handleSelectEntry}
              isLoading={isLoading}
              hasCategoryFilter={hasCategoryFilter}
              tagFilter={tagFilter}
              onClearTagFilter={handleClearTagFilter}
              onTagClick={setContextTagFilter}
              onTogglePin={handleTogglePin}
            />
          </>
        );

      case "backlinks":
        return (
          <>
            {/* Header for backlinks view */}
            <div className="sticky top-0 z-10 border-b bg-background p-4 space-y-3">
              <PageHeader
                title="Context"
                className="mb-0"
                actions={
                  <>
                    <ContextViewSwitcher />
                    <Button size="sm" variant="outline" onClick={handleUploadClick} className="gap-1.5">
                      <Upload className="size-3.5" />
                      Upload
                    </Button>
                    <NewButton />
                  </>
                }
              />
            </div>
            <div className="p-4">
              <ContextMapCard />
              {mapFilterEntryIds && (
                <div className="mb-3">
                  <ContextMapFilterPill onClear={handleClearMapFilter} />
                </div>
              )}
            </div>
            <ContextBacklinksView
              selectedId={selectedEntryId}
              onSelect={handleSelectEntry}
            />
          </>
        );

      case "list":
      default:
        return (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 border-b bg-background p-4 space-y-3">
              {/* Row 1: Title + View Switcher + New button */}
              <PageHeader
                title="Context"
                className="mb-0"
                actions={
                  <>
                    <ContextViewSwitcher />
                    <Button size="sm" variant="outline" onClick={handleUploadClick} className="gap-1.5">
                      <Upload className="size-3.5" />
                      Upload
                    </Button>
                    <NewButton />
                  </>
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

            {/* Context Map card */}
            <div className="p-4 pb-0">
              <ContextMapCard />
              {mapFilterEntryIds && (
                <div className="mb-3">
                  <ContextMapFilterPill onClear={handleClearMapFilter} />
                </div>
              )}
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
          </>
        );
    }
  }

  return (
    <div className="flex h-full">
      {/* Hidden file input for Upload button */}
      <input
        ref={uploadFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadFileChange}
        aria-hidden="true"
      />

      {/* Left panel: view content */}
      <div
        className={`flex-1 flex flex-col ${isFullBleedView ? "" : "border-r overflow-y-auto"} ${
          !isFullBleedView && (showDetail || showEditor) ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Graph + Canvas full-bleed views share the inline header. */}
        {isFullBleedView && (
          <div className="sticky top-0 z-10 border-b bg-background p-4 space-y-3">
            <PageHeader
              title="Context"
              className="mb-0"
              actions={
                <>
                  <ContextViewSwitcher />
                  <Button size="sm" variant="outline" onClick={handleUploadClick} className="gap-1.5">
                    <Upload className="size-3.5" />
                    Upload
                  </Button>
                  <NewButton />
                </>
              }
            />
            {/* Map card only on graph view; canvas has its own toolbar. */}
            {isGraphView && (
              <>
                <ContextMapCard />
                {mapFilterEntryIds && (
                  <ContextMapFilterPill onClear={handleClearMapFilter} />
                )}
              </>
            )}
          </div>
        )}
        {renderLeftPanelContent()}
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
