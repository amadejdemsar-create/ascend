"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  SlidersHorizontalIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SortItem } from "@ascend/core";
import type {
  DatabaseResponse,
  DatabaseViewResponse,
  DatabaseFieldResponse,
} from "@/lib/hooks/use-databases";
import { useUpdateView } from "@/lib/hooks/use-database-views";
import { FilterBuilder, type Filter } from "./filter-builder";
import { SortBuilder } from "./sort-builder";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ViewConfigPopoverProps {
  database: DatabaseResponse;
  view: DatabaseViewResponse;
  onClose?: () => void;
  /** Pre-fill an initial filter clause for a specific field (e.g., from
   *  the table header "Filter by this column" action). */
  initialFilterFieldId?: string;
  /** Which tab to open initially. */
  initialTab?: "filter" | "sort" | "properties" | "layout";
}

// ── Helper: get default operator for field type ──────────────────────────

function getDefaultOpForType(type: string): string {
  switch (type) {
    case "TEXT":
    case "URL":
    case "EMAIL":
    case "PHONE":
      return "contains";
    case "NUMBER":
    case "RATING":
      return "equals";
    case "DATE":
      return "after";
    case "SELECT":
      return "equals";
    case "MULTI_SELECT":
      return "contains_any";
    case "RELATION":
      return "relation_contains";
    case "CHECKBOX":
      return "equals";
    case "USER":
      return "equals";
    case "FILE":
      return "is_not_empty";
    case "FORMULA":
      return "contains";
    default:
      return "equals";
  }
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Unified view configuration popover.
 *
 * Surfaces four tabs: Filter, Sort, Properties (show/hide fields), and
 * Layout (view-type-specific config). All changes persist immediately
 * through `useUpdateView`.
 */
export function ViewConfigPopover({
  database,
  view,
  onClose,
  initialFilterFieldId,
  initialTab,
}: ViewConfigPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? "filter");

  const updateView = useUpdateView(database.id);

  // Parse view config safely.
  const viewConfig = useMemo(
    () => (view.config ?? {}) as Record<string, unknown>,
    [view.config],
  );

  // Extract typed values from config.
  const currentFilter = (viewConfig.filter as Filter | undefined) ?? null;
  const currentSort = (viewConfig.sort as SortItem[] | undefined) ?? [];
  const currentHiddenFieldIds = (viewConfig.hiddenFieldIds as string[] | undefined) ?? [];

  // Auto-open when initialFilterFieldId is provided externally.
  useEffect(() => {
    if (initialFilterFieldId && !open) {
      setOpen(true);
    }
  }, [initialFilterFieldId]);

  // When opened with initialFilterFieldId, seed the filter.
  const [hasAppliedInitial, setHasAppliedInitial] = useState(false);

  useEffect(() => {
    if (open && initialFilterFieldId && !hasAppliedInitial) {
      setActiveTab("filter");
      // Only seed if there is no existing filter or it is empty.
      if (!currentFilter || currentFilter.clauses.length === 0) {
        const field = database.fields.find((f) => f.id === initialFilterFieldId);
        if (field) {
          const op = getDefaultOpForType(field.type);
          const seeded: Filter = {
            combinator: "AND",
            clauses: [
              {
                type: "field",
                fieldId: field.id,
                op: op as Filter["clauses"][0] extends { op: infer O } ? O : never,
                value: "",
              },
            ],
          };
          persistConfig({ filter: seeded });
        }
      }
      setHasAppliedInitial(true);
    }
  }, [open, initialFilterFieldId, hasAppliedInitial, currentFilter, database.fields]);

  // Reset the initial-applied flag when the popover closes.
  useEffect(() => {
    if (!open) {
      setHasAppliedInitial(false);
    }
  }, [open]);

  // Persist helper: merges patch into the current view config and mutates.
  const persistConfig = useCallback(
    (patch: Record<string, unknown>) => {
      const merged = { ...viewConfig, ...patch };
      updateView.mutate({ viewId: view.id, config: merged });
    },
    [viewConfig, view.id, updateView],
  );

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleFilterChange = useCallback(
    (next: Filter | null) => {
      persistConfig({ filter: next ?? undefined });
    },
    [persistConfig],
  );

  const handleSortChange = useCallback(
    (next: SortItem[]) => {
      persistConfig({ sort: next.length > 0 ? next : undefined });
    },
    [persistConfig],
  );

  const handleToggleField = useCallback(
    (fieldId: string) => {
      const hiddenSet = new Set(currentHiddenFieldIds);
      if (hiddenSet.has(fieldId)) {
        hiddenSet.delete(fieldId);
      } else {
        hiddenSet.add(fieldId);
      }
      persistConfig({ hiddenFieldIds: Array.from(hiddenSet) });
    },
    [currentHiddenFieldIds, persistConfig],
  );

  const handleShowAll = useCallback(() => {
    persistConfig({ hiddenFieldIds: [] });
  }, [persistConfig]);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  // Active filter/sort indicators.
  const filterCount = currentFilter?.clauses?.length ?? 0;
  const sortCount = currentSort.length;
  const hiddenCount = currentHiddenFieldIds.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="View options"
      >
        <SlidersHorizontalIcon className="size-3.5" aria-hidden="true" />
        Options
        {filterCount > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1 text-[10px] font-medium min-w-[16px]">
            F{filterCount}
          </span>
        )}
        {sortCount > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 text-[10px] font-medium min-w-[16px]">
            S{sortCount}
          </span>
        )}
        {hiddenCount > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground px-1 text-[10px] font-medium min-w-[16px]">
            H{hiddenCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[420px] p-0"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start px-2 h-9 bg-muted/50 border-b rounded-none">
            <TabsTrigger value="filter" className="text-xs">
              Filter{filterCount > 0 && ` (${filterCount})`}
            </TabsTrigger>
            <TabsTrigger value="sort" className="text-xs">
              Sort{sortCount > 0 && ` (${sortCount})`}
            </TabsTrigger>
            <TabsTrigger value="properties" className="text-xs">
              Properties{hiddenCount > 0 && ` (${hiddenCount} hidden)`}
            </TabsTrigger>
            <TabsTrigger value="layout" className="text-xs">
              Layout
            </TabsTrigger>
          </TabsList>

          {/* Filter tab */}
          <TabsContent value="filter" className="p-3 max-h-[360px] overflow-y-auto">
            <FilterBuilder
              fields={database.fields}
              value={currentFilter}
              onChange={handleFilterChange}
            />
          </TabsContent>

          {/* Sort tab */}
          <TabsContent value="sort" className="p-3 max-h-[360px] overflow-y-auto">
            <SortBuilder
              fields={database.fields}
              value={currentSort}
              onChange={handleSortChange}
            />
          </TabsContent>

          {/* Properties tab */}
          <TabsContent value="properties" className="p-3 max-h-[360px] overflow-y-auto">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Show/hide fields
                </span>
                {hiddenCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={handleShowAll}
                    aria-label="Show all fields"
                  >
                    <RotateCcwIcon className="size-3" aria-hidden="true" />
                    Show all
                  </Button>
                )}
              </div>
              {database.fields
                .filter((f) => !f.isPrimary)
                .sort((a, b) => a.position - b.position)
                .map((field) => {
                  const isHidden = currentHiddenFieldIds.includes(field.id);
                  return (
                    <div
                      key={field.id}
                      className="flex items-center justify-between py-1 px-1 rounded hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isHidden ? (
                          <EyeOffIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <EyeIcon className="size-3.5 text-foreground" aria-hidden="true" />
                        )}
                        <span className="text-xs">{field.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {field.type}
                        </span>
                      </div>
                      <Switch
                        checked={!isHidden}
                        onCheckedChange={() => handleToggleField(field.id)}
                        className="scale-75"
                        aria-label={`${isHidden ? "Show" : "Hide"} ${field.name}`}
                      />
                    </div>
                  );
                })}
              {database.fields.filter((f) => !f.isPrimary).length === 0 && (
                <p className="text-xs text-muted-foreground py-2">
                  No configurable fields.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Layout tab (view-type-specific) */}
          <TabsContent value="layout" className="p-3 max-h-[360px] overflow-y-auto">
            <LayoutConfig
              database={database}
              view={view}
              viewConfig={viewConfig}
              persistConfig={persistConfig}
            />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

// ── Layout Config (per view type) ────────────────────────────────────────

interface LayoutConfigProps {
  database: DatabaseResponse;
  view: DatabaseViewResponse;
  viewConfig: Record<string, unknown>;
  persistConfig: (patch: Record<string, unknown>) => void;
}

function LayoutConfig({
  database,
  view,
  viewConfig,
  persistConfig,
}: LayoutConfigProps) {
  const viewType = view.type;

  switch (viewType) {
    case "TABLE":
      return (
        <TableLayoutConfig
          viewConfig={viewConfig}
          persistConfig={persistConfig}
        />
      );
    case "BOARD":
      return (
        <BoardLayoutConfig
          database={database}
          viewConfig={viewConfig}
          persistConfig={persistConfig}
        />
      );
    case "CALENDAR":
      return (
        <CalendarLayoutConfig
          database={database}
          viewConfig={viewConfig}
          persistConfig={persistConfig}
        />
      );
    case "GALLERY":
      return (
        <GalleryLayoutConfig
          database={database}
          viewConfig={viewConfig}
          persistConfig={persistConfig}
        />
      );
    case "TIMELINE":
      return (
        <TimelineLayoutConfig
          database={database}
          viewConfig={viewConfig}
          persistConfig={persistConfig}
        />
      );
    default:
      return (
        <p className="text-xs text-muted-foreground py-2">
          No layout options for this view type.
        </p>
      );
  }
}

// ── TABLE layout ────────────────────────────────────────────────────��────

function TableLayoutConfig({
  viewConfig,
  persistConfig,
}: {
  viewConfig: Record<string, unknown>;
  persistConfig: (patch: Record<string, unknown>) => void;
}) {
  const frozenPrimary = (viewConfig.frozenPrimary as boolean | undefined) ?? true;

  const handleFrozenToggle = useCallback(
    (checked: boolean) => {
      persistConfig({ frozenPrimary: checked });
    },
    [persistConfig],
  );

  const handleResetWidths = useCallback(() => {
    persistConfig({ columnWidths: undefined });
  }, [persistConfig]);

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-medium text-muted-foreground">Table layout</h4>

      <div className="flex items-center justify-between">
        <Label htmlFor="frozen-primary" className="text-xs">
          Freeze primary column
        </Label>
        <Switch
          id="frozen-primary"
          checked={frozenPrimary}
          onCheckedChange={handleFrozenToggle}
          className="scale-75"
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1 w-fit"
        onClick={handleResetWidths}
      >
        <RotateCcwIcon className="size-3" aria-hidden="true" />
        Reset column widths
      </Button>
    </div>
  );
}

// ── BOARD layout ─────────────────────────────────────────────────────────

function BoardLayoutConfig({
  database,
  viewConfig,
  persistConfig,
}: {
  database: DatabaseResponse;
  viewConfig: Record<string, unknown>;
  persistConfig: (patch: Record<string, unknown>) => void;
}) {
  const groupByFieldId = viewConfig.groupByFieldId as string | undefined;
  const visiblePropertyIds = (viewConfig.visiblePropertyIds as string[] | undefined) ?? [];

  // Only SELECT and MULTI_SELECT are valid group-by targets.
  const groupByFields = useMemo(
    () => database.fields.filter((f) => f.type === "SELECT" || f.type === "MULTI_SELECT"),
    [database.fields],
  );

  const handleGroupByChange = useCallback(
    (fieldId: string | null) => {
      if (!fieldId) return;
      persistConfig({ groupByFieldId: fieldId });
    },
    [persistConfig],
  );

  const handleToggleVisibleProp = useCallback(
    (fieldId: string) => {
      const set = new Set(visiblePropertyIds);
      if (set.has(fieldId)) {
        set.delete(fieldId);
      } else {
        set.add(fieldId);
      }
      persistConfig({ visiblePropertyIds: Array.from(set) });
    },
    [visiblePropertyIds, persistConfig],
  );

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-medium text-muted-foreground">Board layout</h4>

      <div className="flex flex-col gap-1">
        <Label htmlFor="group-by-field" className="text-xs">
          Group by
        </Label>
        <Select value={groupByFieldId ?? ""} onValueChange={handleGroupByChange}>
          <SelectTrigger id="group-by-field" className="h-7 text-xs">
            <SelectValue placeholder="Select a field" />
          </SelectTrigger>
          <SelectContent>
            {groupByFields.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {groupByFields.length === 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Add a SELECT or MULTI_SELECT field to group cards.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Visible properties on cards</span>
        {database.fields
          .filter((f) => !f.isPrimary && f.type !== "FORMULA")
          .map((field) => (
            <div key={field.id} className="flex items-center justify-between py-0.5">
              <span className="text-xs">{field.name}</span>
              <Switch
                checked={visiblePropertyIds.includes(field.id)}
                onCheckedChange={() => handleToggleVisibleProp(field.id)}
                className="scale-75"
                aria-label={`Show ${field.name} on cards`}
              />
            </div>
          ))}
      </div>
    </div>
  );
}

// ── CALENDAR layout ──────────────────────────────────────────────────────

function CalendarLayoutConfig({
  database,
  viewConfig,
  persistConfig,
}: {
  database: DatabaseResponse;
  viewConfig: Record<string, unknown>;
  persistConfig: (patch: Record<string, unknown>) => void;
}) {
  const dateFieldId = viewConfig.dateFieldId as string | undefined;

  const dateFields = useMemo(
    () => database.fields.filter((f) => f.type === "DATE"),
    [database.fields],
  );

  const handleDateFieldChange = useCallback(
    (fieldId: string | null) => {
      if (!fieldId) return;
      persistConfig({ dateFieldId: fieldId });
    },
    [persistConfig],
  );

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-medium text-muted-foreground">Calendar layout</h4>

      <div className="flex flex-col gap-1">
        <Label htmlFor="date-field" className="text-xs">
          Date field
        </Label>
        <Select value={dateFieldId ?? ""} onValueChange={handleDateFieldChange}>
          <SelectTrigger id="date-field" className="h-7 text-xs">
            <SelectValue placeholder="Select a date field" />
          </SelectTrigger>
          <SelectContent>
            {dateFields.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dateFields.length === 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Add a DATE field to use calendar view.
          </p>
        )}
      </div>
    </div>
  );
}

// ── GALLERY layout ───────────────────────────────────────────────────────

function GalleryLayoutConfig({
  database,
  viewConfig,
  persistConfig,
}: {
  database: DatabaseResponse;
  viewConfig: Record<string, unknown>;
  persistConfig: (patch: Record<string, unknown>) => void;
}) {
  const coverFieldId = viewConfig.coverFieldId as string | undefined;
  const visiblePropertyIds = (viewConfig.visiblePropertyIds as string[] | undefined) ?? [];

  const coverFields = useMemo(
    () => database.fields.filter((f) => f.type === "FILE" || f.type === "URL"),
    [database.fields],
  );

  const handleCoverFieldChange = useCallback(
    (fieldId: string | null) => {
      if (!fieldId) return;
      persistConfig({ coverFieldId: fieldId === "__none__" ? undefined : fieldId });
    },
    [persistConfig],
  );

  const handleToggleVisibleProp = useCallback(
    (fieldId: string) => {
      const set = new Set(visiblePropertyIds);
      if (set.has(fieldId)) {
        set.delete(fieldId);
      } else {
        set.add(fieldId);
      }
      persistConfig({ visiblePropertyIds: Array.from(set) });
    },
    [visiblePropertyIds, persistConfig],
  );

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-medium text-muted-foreground">Gallery layout</h4>

      <div className="flex flex-col gap-1">
        <Label htmlFor="cover-field" className="text-xs">
          Cover field
        </Label>
        <Select value={coverFieldId ?? "__none__"} onValueChange={handleCoverFieldChange}>
          <SelectTrigger id="cover-field" className="h-7 text-xs">
            <SelectValue placeholder="No cover" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {coverFields.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Visible properties on cards</span>
        {database.fields
          .filter((f) => !f.isPrimary && f.type !== "FORMULA")
          .map((field) => (
            <div key={field.id} className="flex items-center justify-between py-0.5">
              <span className="text-xs">{field.name}</span>
              <Switch
                checked={visiblePropertyIds.includes(field.id)}
                onCheckedChange={() => handleToggleVisibleProp(field.id)}
                className="scale-75"
                aria-label={`Show ${field.name} on cards`}
              />
            </div>
          ))}
      </div>
    </div>
  );
}

// ── TIMELINE layout ──────────────────────────────────────────────────────

function TimelineLayoutConfig({
  database,
  viewConfig,
  persistConfig,
}: {
  database: DatabaseResponse;
  viewConfig: Record<string, unknown>;
  persistConfig: (patch: Record<string, unknown>) => void;
}) {
  const startFieldId = viewConfig.startFieldId as string | undefined;
  const endFieldId = viewConfig.endFieldId as string | undefined;
  const zoom = (viewConfig.zoom as string | undefined) ?? "week";

  const dateFields = useMemo(
    () => database.fields.filter((f) => f.type === "DATE"),
    [database.fields],
  );

  const handleStartFieldChange = useCallback(
    (fieldId: string | null) => {
      if (!fieldId) return;
      persistConfig({ startFieldId: fieldId });
    },
    [persistConfig],
  );

  const handleEndFieldChange = useCallback(
    (fieldId: string | null) => {
      if (!fieldId) return;
      persistConfig({ endFieldId: fieldId });
    },
    [persistConfig],
  );

  const handleZoomChange = useCallback(
    (newZoom: string | null) => {
      if (!newZoom) return;
      persistConfig({ zoom: newZoom });
    },
    [persistConfig],
  );

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-medium text-muted-foreground">Timeline layout</h4>

      <div className="flex flex-col gap-1">
        <Label htmlFor="start-field" className="text-xs">
          Start date field
        </Label>
        <Select value={startFieldId ?? ""} onValueChange={handleStartFieldChange}>
          <SelectTrigger id="start-field" className="h-7 text-xs">
            <SelectValue placeholder="Select start field" />
          </SelectTrigger>
          <SelectContent>
            {dateFields.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="end-field" className="text-xs">
          End date field
        </Label>
        <Select value={endFieldId ?? ""} onValueChange={handleEndFieldChange}>
          <SelectTrigger id="end-field" className="h-7 text-xs">
            <SelectValue placeholder="Select end field" />
          </SelectTrigger>
          <SelectContent>
            {dateFields.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dateFields.length < 2 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Add at least two DATE fields for the timeline view.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="zoom-select" className="text-xs">
          Zoom
        </Label>
        <Select value={zoom} onValueChange={handleZoomChange}>
          <SelectTrigger id="zoom-select" className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
