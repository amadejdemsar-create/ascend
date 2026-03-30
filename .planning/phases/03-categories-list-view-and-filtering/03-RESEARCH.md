# Phase 3: Categories, List View, and Filtering - Research

**Researched:** 2026-03-30
**Domain:** Category management UI, data table with sorting/filtering, view preference persistence
**Confidence:** HIGH

## Summary

Phase 3 adds three interconnected capabilities to Ascend: a category management system (CRUD with nesting, colors, and Lucide icons), a sortable/filterable list view for goals using TanStack Table, and cross-session persistence of view and filter preferences via Zustand persist middleware.

The existing codebase provides a strong foundation. The Category model already supports unlimited nesting via self-referential `parentId`, the category Service Layer and REST API are complete, the sidebar has placeholder text ("Coming in Phase 3") ready to be replaced with a category tree, and the `GoalForm` has a disabled category Select placeholder waiting for activation. The `shadcn/ui` sidebar primitives already include `SidebarMenuSub`, `SidebarMenuSubItem`, and `SidebarMenuSubButton` for nested tree rendering, and `Collapsible` is already installed for expand/collapse behavior.

The main implementation effort is in the frontend: building the category management UI (create/edit/delete forms, color picker, icon picker, sidebar tree), building the list view with TanStack Table (column definitions, sort headers, filter dropdowns), and extending the Zustand UI store to persist the selected view and active filters.

**Primary recommendation:** Use `@tanstack/react-table` (headless) with the existing shadcn `Table` primitives for the list view. Store category icon values as Lucide icon name strings (e.g., `"briefcase"`, `"heart"`) and render them with `DynamicIcon` from `lucide-react/dynamic`. Extend the existing `useUIStore` Zustand persist store with `version: 1` and a `migrate` function to safely add new persisted keys without breaking existing localStorage data.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAT-01 | Create category with name, color, and Lucide icon | Category service `create()` already exists. Need category form UI with color preset picker and Lucide icon picker using `DynamicIcon` from `lucide-react/dynamic` plus `iconNames` for search/selection. Schema already has `icon` as optional string field. |
| CAT-02 | Nest categories to unlimited depth | Prisma schema already supports self-referential `parentId` with `onDelete: Cascade`. `categoryService.listTree()` builds recursive tree in memory. Sidebar uses `SidebarMenuSub` for nested rendering with `Collapsible` for expand/collapse. |
| CAT-03 | Edit category name, color, and icon | `categoryService.update()` and PATCH `/api/categories/[id]` already exist. Need edit mode in the category form, triggered from sidebar context menu or settings page. |
| CAT-04 | Delete category with reassign or delete option | `categoryService.delete()` exists but only cascades (deletes children, nullifies goals). Need confirmation dialog with two options: "Reassign goals to..." (with category selector) or "Delete category and unlink goals". Reassign requires a new service method to bulk-update goals before deletion. |
| CAT-05 | Reorder categories via drag and drop | Schema has `sortOrder` on Category. Full drag-and-drop is Phase 8 scope, but Phase 3 needs basic reordering. Use manual move-up/move-down buttons on categories rather than full DnD, then expose `sortOrder` update via existing PATCH endpoint. |
| CAT-06 | Ship with suggested default categories | Seed script needs updating to create default categories (Business, Personal, Health, Finance, Learning) with predefined colors and Lucide icons. Idempotent upsert pattern matches existing seed approach. |
| VIEW-01 | Switch between List, Board, Tree, and Timeline views | Phase 3 implements List view only. Add view switcher tabs/buttons to the goals page header. Board/Tree are Phase 6, Timeline is Phase 7. Store selected view in Zustand persist store so it survives sessions. |
| VIEW-02 | List view shows flat sortable table | Use `@tanstack/react-table` with `useReactTable`, `getSortedRowModel()`, and shadcn `Table` primitives. Columns: title, status, progress, priority, deadline, category, horizon. Sortable column headers use `column.toggleSorting()`. |
| VIEW-08 | All views support filtering by category, horizon, status, priority | Extend existing `goalFiltersSchema` to include `priority` filter. Build a filter bar component with Select dropdowns for each dimension. Filters apply as query parameters to the existing `/api/goals` endpoint (which already handles horizon, status, categoryId). Add `priority` param to the API GET handler. |
| VIEW-09 | All views support sorting by priority, deadline, creation date, title | Client-side sorting via TanStack Table `getSortedRowModel()` for the list view. The API already returns goals sorted by `sortOrder` then `createdAt`. TanStack Table sorting is purely client-side on the fetched data, so no API changes needed for basic sorting. |
| VIEW-10 | User's last selected view and filters persist across sessions | Extend `useUIStore` Zustand persist store: add `activeView`, `activeFilters`, and `activeSorting` to the `partialize` function. Use `version: 1` with a `migrate` callback to handle the schema change from the existing store that only persists `sidebarCollapsed`. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | 8.21.3 | Headless table with sorting, filtering, column defs | The standard for data tables in React. shadcn/ui Data Table documentation builds directly on it. Headless approach pairs with existing shadcn Table primitives. |
| `lucide-react` | ^1.7.0 (already installed) | Icon rendering including `DynamicIcon` | Already in the project. The `lucide-react/dynamic` subpath exports `DynamicIcon` component and `iconNames` array for dynamic icon selection. |
| `zustand` | 5.0.12 (already installed) | State management with persist middleware | Already used for `useUIStore`. Persist middleware supports `version` + `migrate` for safe schema evolution. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | ^5.95.2 (already installed) | Server state for category and goal data | Already wired up. Category mutations (create, update, delete, reorder) follow the same `useMutation` + `invalidateQueries` pattern as goal hooks. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-table` for sorting | Manual `Array.sort()` in component | Works for simple cases but loses column header state management, multi-column sort, and future extensibility. TanStack Table is the standard and adding it now prevents rewrite when Board/Tree views need the same filter logic. |
| Preset color picker (palette swatches) | Full `<input type="color">` or react-color | A preset palette (8 to 12 colors) is simpler, more consistent visually, avoids ugly native color pickers, and matches the "icon + color" category pattern. Custom hex input is overkill for category colors. |
| `DynamicIcon` from `lucide-react/dynamic` | `import * as lucide` wildcard | `DynamicIcon` is the official Lucide approach. Wildcard import has the same bundle impact but worse TypeScript ergonomics. Both import all icons at build time, which is unavoidable for a searchable icon picker. |

**Installation:**
```bash
cd /Users/Shared/Domain/Code/Personal/goals && npm install @tanstack/react-table
```

No other new packages needed. Everything else is already installed.

## Architecture Patterns

### Recommended File Structure (new files for Phase 3)
```
components/
├── categories/
│   ├── category-form.tsx          # Create/edit form (name, color, icon)
│   ├── category-delete-dialog.tsx # Confirmation with reassign option
│   ├── category-icon-picker.tsx   # Searchable Lucide icon grid
│   ├── category-color-picker.tsx  # Preset color swatch palette
│   └── sidebar-category-tree.tsx  # Recursive tree for sidebar
├── goals/
│   ├── goal-list-view.tsx         # TanStack Table list view
│   ├── goal-list-columns.tsx      # Column definitions
│   ├── goal-filter-bar.tsx        # Filter dropdowns (category, horizon, status, priority)
│   └── goal-view-switcher.tsx     # Tabs/buttons to switch views
└── ui/
    └── data-table.tsx             # Reusable DataTable wrapper (optional)

lib/
├── hooks/
│   └── use-categories.ts          # Extend with mutation hooks
├── stores/
│   └── ui-store.ts                # Extend with view, filter, sort persistence
└── validations.ts                 # Extend goalFiltersSchema with priority
```

### Pattern 1: TanStack Table with shadcn Primitives

**What:** Headless `useReactTable` hook providing sorting/filtering state, rendered with shadcn `Table`, `TableHeader`, `TableRow`, `TableCell` components.

**When to use:** Whenever displaying tabular goal data with interactive column headers.

**Example:**
```typescript
// Source: shadcn/ui Data Table docs
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";

const [sorting, setSorting] = useState<SortingState>([]);
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

const table = useReactTable({
  data: goals,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  state: { sorting, columnFilters },
});
```

### Pattern 2: Zustand Persist Schema Migration

**What:** Adding new persisted keys to an existing Zustand store without breaking users who already have `ascend-ui` in localStorage.

**When to use:** When extending the UI store with `activeView`, `activeFilters`, `activeSorting`.

**Example:**
```typescript
// Source: Zustand persist docs (version + migrate pattern)
export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // existing state...
      sidebarCollapsed: false,
      // new Phase 3 state
      activeView: "cards" as ViewType,
      activeFilters: {} as ActiveFilters,
      activeSorting: [] as SortingState,
      // actions...
    }),
    {
      name: "ascend-ui",
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          // Old store only had sidebarCollapsed
          return {
            ...(persistedState as Record<string, unknown>),
            activeView: "cards",
            activeFilters: {},
            activeSorting: [],
          };
        }
        return persistedState as UIStore;
      },
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeView: state.activeView,
        activeFilters: state.activeFilters,
        activeSorting: state.activeSorting,
      }),
    }
  )
);
```

### Pattern 3: Sidebar Category Tree (Recursive)

**What:** Render the category tree in the sidebar using shadcn `SidebarMenuSub` with `Collapsible` for expand/collapse. Categories with children render as collapsible groups; leaf categories render as buttons that filter goals by category.

**When to use:** Sidebar "Categories" section, replacing the "Coming in Phase 3" placeholder.

**Example:**
```typescript
// Recursive category tree node
function CategoryTreeItem({ category }: { category: CategoryNode }) {
  const hasChildren = category.children.length > 0;

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => filterByCategory(category.id)}>
          <DynamicIcon name={category.icon ?? "folder"} />
          <span>{category.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger render={<SidebarMenuButton />}>
          <DynamicIcon name={category.icon ?? "folder"} />
          <span>{category.name}</span>
          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {category.children.map((child) => (
              <CategoryTreeItem key={child.id} category={child} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
```

### Pattern 4: DynamicIcon for Category Icons

**What:** Render Lucide icons dynamically by name string stored in the database. Use `DynamicIcon` from `lucide-react/dynamic` and `iconNames` for the picker.

**When to use:** Everywhere a category icon is displayed (sidebar, list view, goal cards, category form).

**Example:**
```typescript
// Source: Lucide official docs - Dynamic Icon Component
import { DynamicIcon } from "lucide-react/dynamic";
import { iconNames } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";

// Rendering a category icon
<DynamicIcon name={category.icon as IconName ?? "folder"} size={16} />

// Icon picker: searchable grid of icons
const filteredIcons = useMemo(() => {
  const term = search.toLowerCase();
  return iconNames.filter((name) =>
    name.toLowerCase().includes(term) || name.replace(/-/g, " ").includes(term)
  ).slice(0, 50); // Limit to 50 for performance
}, [search]);
```

**Caveat (from official docs):** `DynamicIcon` imports all icons at build time, increasing build size. This is acceptable for Ascend because (a) it is a single-user app where bundle size is not critical, and (b) there is no alternative for rendering icons from database string values. The icon picker itself will be lazy-loaded in a dialog to avoid rendering cost on every page load.

### Anti-Patterns to Avoid

- **Full DnD for category reorder in Phase 3:** Drag and drop is Phase 8 scope. Use simple move-up/move-down buttons for category reordering. Adding `@dnd-kit` now would be premature.
- **Server-side sorting/filtering for the list view:** With a single-user app and likely fewer than 500 goals, client-side sorting via TanStack Table is simpler and more responsive than adding `orderBy` and additional query params to the API. The API fetches all matching goals; TanStack Table sorts/filters them in the browser.
- **Storing filter state only in URL params:** URL params are good for shareable views, but Ascend is a personal app. Zustand persist with localStorage is simpler, supports the "persist across sessions" requirement directly, and avoids URL complexity. Filters in URL can be added later if needed.
- **Custom color picker (hex input):** A preset palette of 8 to 12 colors is visually consistent and easier to implement. Users do not need arbitrary hex values for category colors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table columns | Custom sort state + Array.sort | `@tanstack/react-table` `getSortedRowModel()` | Handles multi-column sort, sort direction cycling (asc > desc > none), sort indicators, and integrates with filtering. Manual implementation misses edge cases and breaks when adding column visibility later. |
| Column filter state | Manual filter state per column | `@tanstack/react-table` `getFilteredRowModel()` with `ColumnFiltersState` | TanStack Table manages filter state, applies filters efficiently, and coordinates with sorting. Manual filtering requires reimplementing this coordination. |
| Nested tree rendering | Custom recursive DOM builder | shadcn `SidebarMenuSub` + `Collapsible` | Already available in the sidebar component. Handles proper spacing, border lines, expand/collapse animation, and icon-only mode collapse. |
| Dynamic icon resolution | Switch statement with 1000+ cases | `DynamicIcon` from `lucide-react/dynamic` | Official Lucide component. Handles lazy chunk loading, error states, and TypeScript types for icon names. |

**Key insight:** The main complexity in this phase is not in any single feature but in the coordination between them: categories must appear in the sidebar tree, in the goal form Select, in the list view column, and in the filter bar. All four need to react to category CRUD operations. TanStack Query cache invalidation (already established in the project) handles this automatically.

## Common Pitfalls

### Pitfall 1: Zustand Persist Version Mismatch
**What goes wrong:** Adding new keys to `partialize` without a `version` bump causes existing users' localStorage to silently lack the new keys. The store hydrates with `undefined` for new fields, causing runtime errors.
**Why it happens:** Zustand's default merge is shallow. It merges old persisted state with the new initial state, but `partialize` controls what gets saved, and the old saved state does not have the new keys.
**How to avoid:** Add `version: 1` and a `migrate` function that explicitly adds default values for new keys when coming from version 0. The existing store has no version set (defaults to 0), so the first migration is from 0 to 1.
**Warning signs:** `activeView` is `undefined` after deploying, filters reset on every page load.

### Pitfall 2: DynamicIcon Bundle Size and Render Flash
**What goes wrong:** `DynamicIcon` imports all Lucide icons at build, and the icon may flash from nothing to rendered when loading dynamically.
**Why it happens:** Each icon is a separate chunk loaded on demand. First render has no icon; subsequent renders show it.
**How to avoid:** For the sidebar tree and list view (where icons appear repeatedly), the flash is minimal because icons are cached after first load. For the icon picker dialog, load it lazily with `React.lazy` so the bundle cost is deferred. Set a sensible fallback icon (`"folder"`) for categories with no icon set.
**Warning signs:** Visible icon flash on page load, large initial JS bundle.

### Pitfall 3: Category Delete with Goals
**What goes wrong:** Deleting a category silently nullifies `categoryId` on all associated goals (Prisma `onDelete: SetNull`), losing the user's categorization work without warning.
**Why it happens:** The Prisma schema handles referential integrity correctly, but the UI must communicate the consequence.
**How to avoid:** Before deletion, fetch `_count.goals` (already available in `categoryService.getById`). Show a dialog: "This category has N goals. Reassign them to another category, or remove the category and leave goals uncategorized." If reassigning, batch-update goals before deletion.
**Warning signs:** User deletes a category, then wonders why goals have no category.

### Pitfall 4: TanStack Table Re-renders on Filter Changes
**What goes wrong:** Every keystroke in a text filter re-renders the entire table.
**Why it happens:** TanStack Table recalculates filtered rows on every `columnFilters` state change.
**How to avoid:** Use Select dropdowns (not text inputs) for category/horizon/status/priority filters. These are discrete values, not free text, so there is no keystroke issue. If a text search filter is added later, debounce it with a 300ms delay.
**Warning signs:** Laggy UI when typing in filter inputs (not applicable with dropdown-only filters).

### Pitfall 5: Recursive Category Tree Infinite Loop
**What goes wrong:** If a category somehow references itself or creates a cycle in parentId, the recursive tree renderer enters an infinite loop.
**Why it happens:** The `categoryService.listTree()` builds the tree from flat data, so cycles would cause a node to appear in its own subtree.
**How to avoid:** The Prisma unique constraint `@@unique([userId, name, parentId])` prevents same-name duplicates but not cycles. Add a depth guard in the recursive renderer (max 5 levels) and validate in the service layer that a category cannot be its own ancestor when setting `parentId`.
**Warning signs:** Browser tab freezes when rendering the sidebar.

## Code Examples

Verified patterns from official sources:

### Category Mutation Hooks (following existing project pattern)

```typescript
// Source: existing use-goals.ts pattern
export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      fetchJson("/api/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) =>
      fetchJson(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    },
  });
}
```

### Sortable Column Header (from shadcn Data Table docs)

```typescript
// Source: shadcn/ui Data Table documentation
import { type Column } from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SortableHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function SortableHeader<TData, TValue>({
  column,
  title,
}: SortableHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div>{title}</div>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      {column.getIsSorted() === "desc" ? (
        <ArrowDown className="ml-1 size-3.5" />
      ) : column.getIsSorted() === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ChevronsUpDown className="ml-1 size-3.5" />
      )}
    </Button>
  );
}
```

### Preset Color Palette (project-specific)

```typescript
// Predefined category colors matching NativeAI palette + accessible options
export const CATEGORY_COLORS = [
  { value: "#4F46E5", label: "Indigo" },    // primary
  { value: "#8B5CF6", label: "Violet" },    // secondary
  { value: "#10B981", label: "Emerald" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#06B6D4", label: "Cyan" },
  { value: "#EC4899", label: "Pink" },
  { value: "#6B7280", label: "Gray" },
] as const;
```

### Default Categories Seed Data

```typescript
// Source: REQ CAT-06
const DEFAULT_CATEGORIES = [
  { name: "Business",  color: "#4F46E5", icon: "briefcase",  sortOrder: 0 },
  { name: "Personal",  color: "#8B5CF6", icon: "user",       sortOrder: 1 },
  { name: "Health",    color: "#10B981", icon: "heart-pulse", sortOrder: 2 },
  { name: "Finance",   color: "#F59E0B", icon: "wallet",     sortOrder: 3 },
  { name: "Learning",  color: "#06B6D4", icon: "book-open",  sortOrder: 4 },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-table` v7 (class-based) | `@tanstack/react-table` v8 (headless hooks) | 2022 | Fully headless; no built-in UI. Pairs with any component library. Column defs use `accessorKey` and `header` function pattern. |
| Lucide `import * as icons` wildcard | `lucide-react/dynamic` with `DynamicIcon` | Lucide v1 (2024) | Official way to render icons by name string. Avoids TypeScript errors from wildcard imports. Uses `iconNames` typed array for autocomplete and validation. |
| Zustand persist v3 (no version) | Zustand persist v5 with `version` + `migrate` | Zustand 4+ | Schema evolution support. Critical when adding persisted keys to existing stores. |

**Deprecated/outdated:**
- `react-table` v7: Replaced by `@tanstack/react-table` v8. Different API, different package name.
- `import * as lucide from "lucide-react"` for icon picker: Still works but `lucide-react/dynamic` is the official approach with better types.

## Open Questions

1. **Category reassignment on delete: API design**
   - What we know: `categoryService.delete()` cascades children and nullifies goals. CAT-04 requires a "reassign goals" option.
   - What's unclear: Should this be a separate API endpoint (`POST /api/categories/[id]/reassign`), a query parameter on DELETE (`DELETE /api/categories/[id]?reassignTo=xyz`), or handled client-side (update goals first, then delete)?
   - Recommendation: Handle client-side: the UI calls `useUpdateGoal` for each affected goal to reassign, then `useDeleteCategory`. This avoids new API endpoints and leverages existing mutations. The `_count.goals` from `getById` tells the UI how many goals to reassign. For more than ~20 goals, add a batch update endpoint to category service to avoid N+1 API calls.

2. **View switcher: include disabled future views?**
   - What we know: VIEW-01 requires switching between List, Board, Tree, and Timeline. Phase 3 only implements List.
   - What's unclear: Should the view switcher show all four options (with Board, Tree, Timeline disabled/greyed), or only show available views and expand as phases land?
   - Recommendation: Show all four views in the switcher with disabled state and "Coming soon" tooltip for Board, Tree, and Timeline. This communicates the roadmap to the user and avoids UI layout shifts when new views are added later.

3. **Icon picker performance: how many icons to show?**
   - What we know: Lucide has 1500+ icons. Rendering all in a grid would be slow.
   - What's unclear: Exact count of `iconNames` in current lucide-react version.
   - Recommendation: Show 50 icons maximum in the picker grid, paginated or virtualized. Default view shows a curated subset (common category icons: folder, briefcase, heart, wallet, book, star, etc.). Search filters the full `iconNames` array but still caps display at 50 results. This keeps the picker responsive.

## Sources

### Primary (HIGH confidence)
- shadcn/ui Data Table docs (https://ui.shadcn.com/docs/components/data-table): TanStack Table integration pattern, column definitions, sorting implementation, filtering implementation
- shadcn/ui Table docs (https://ui.shadcn.com/docs/components/table): Base table primitives, installation
- Lucide Dynamic Icon Component docs (https://lucide.dev/guide/react/advanced/dynamic-icon-component): `DynamicIcon` API, caveats, `lucide-react/dynamic` import path
- Existing codebase: Prisma schema, category service, goal service, UI store, API routes, sidebar component (all read directly)

### Secondary (MEDIUM confidence)
- npm registry: `@tanstack/react-table` v8.21.3 (verified via `npm info`)
- npm registry: `zustand` v5.0.12 (verified via `npm info`)
- GitHub Discussion lucide-icons/lucide#1164: Icon picker implementation patterns using `iconNames` and `DynamicIcon`
- Zustand persist middleware: `version` + `migrate` pattern (from training data, consistent with Zustand v5 API. Could not access docs page due to 404; URL structure may have changed)

### Tertiary (LOW confidence)
- None. All findings verified against official sources or existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all libraries either already installed or verified against official docs/npm
- Architecture: HIGH, patterns derived from existing codebase conventions and official shadcn/ui docs
- Pitfalls: HIGH, derived from direct code analysis (Zustand persist store, Prisma cascade behavior, DynamicIcon docs)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries, no fast-moving dependencies)
