---
description: Component patterns for the Ascend UI including layout, interaction, and data fetching conventions
globs: components/**,app/(app)/**
---

# Component Patterns

## Two-Panel Layout

All authenticated pages render inside `app/(app)/layout.tsx`, which provides:
- `SidebarProvider` + `AppSidebar` (left panel with nav links and category tree)
- `SidebarInset` > `main` (right panel where page content renders)
- `BottomTabBar` for mobile
- `CommandPalette` (Cmd+K)
- `GoalModal` (shared modal for create/edit goals)

Page components in `app/(app)/<page>/page.tsx` render directly into the main area. They do not need to import layout components.

## Page Structure

A typical page has: filter bar at top, quick-add input, list/grid view, and a detail panel that opens on item selection.

```
+------------------+------------------+
| Sidebar          | Filter bar       |
| (categories,     | Quick-add        |
|  nav links)      | List/Table view  |
|                  | or               |
|                  | Detail panel     |
+------------------+------------------+
```

## Quick-Add Pattern

Inline input at the top of a list for fast creation. See `components/goals/quick-add.tsx` and `components/todos/todo-quick-add.tsx`.

```tsx
const [title, setTitle] = useState("");
const createItem = useCreateItem();  // mutation hook

async function handleCreate() {
  const trimmed = title.trim();
  if (!trimmed) return;
  try {
    await createItem.mutateAsync({ title: trimmed, ...defaults });
    toast.success("Created!");
    setTitle("");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Something went wrong");
  }
}
```

Key conventions:
- Enter key triggers creation
- Input clears after success
- `toast.success` / `toast.error` from `sonner` for feedback
- Button disabled while `isPending`

## Filter Bar Pattern

Dropdown selects for enum fields (horizon, status, priority) plus category. Uses Zustand `useUIStore` for filter state persistence. See `components/goals/goal-filter-bar.tsx`.

- Filters stored in `useUIStore` so they persist across navigation
- Reset button clears all filters
- Active filter count shown as badge

## Detail Panel Pattern

Clicking a list item shows a detail panel. For goals, this is `components/goals/goal-detail.tsx`; for todos, `components/todos/todo-detail.tsx`; for context, `components/context/context-entry-detail.tsx`.

Pattern:
- Uses the `useGoal(id)` / `useTodo(id)` hook to fetch single item
- Click-to-edit: field displays value as text; clicking switches to input/textarea
- Status changes via `GoalStatusSelect` / inline select
- Delete triggers a confirmation dialog (`goal-delete-dialog.tsx`)
- Close button deselects the item via `useUIStore`
- Loading state shows `Skeleton` components

## View Switcher

`components/goals/goal-view-switcher.tsx` lets users toggle between List, Tree, and Timeline views. The active view is stored in `useUIStore.activeView`. Available values: `"list"`, `"tree"`, `"timeline"`.

## Data Fetching

Components use hooks from `lib/hooks/`:
- `useGoals(filters)`, `useGoal(id)`, `useCreateGoal()`, `useUpdateGoal()`, `useDeleteGoal()`
- `useTodos(filters)`, `useTodo(id)`, `useCreateTodo()`, `useCompleteTodo()`
- `useCategories()`, `useCreateCategory()`
- `useContextEntries(filters)`, `useContextEntry(id)`
- `useDashboard()`

Never call `fetch()` directly in components. Always go through hooks.

## UI Components

All base UI components from shadcn live in `components/ui/`. Import paths:
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
```

Icons from `lucide-react`. Custom component: `XpProgressBar` in `components/ui/xp-progress-bar.tsx`.

## State Management Split

- **Server data** (goals, todos, context, categories, dashboard): React Query hooks
- **UI state** (sidebar, view mode, filters, sorting, selected item, modal): Zustand `useUIStore`
- **Never** store server data in Zustand. Never use React Query for UI-only state.

## Loading and Empty States

- Use `Skeleton` for loading placeholders
- Show a friendly message with an icon when a list is empty
- `isPending` / `isLoading` from React Query hooks for loading detection
