# Ascend Component Catalog

**Total**: 85 reusable components across 13 directories.

Use this catalog before creating any new component. Duplicating existing components is the most common UI mistake in Ascend. Check here first, then grep for similar implementations.

For each component: file path, one-line purpose, where it is used, and key props.

## Table of Contents

- [UI Primitives (shadcn)](#ui-primitives-shadcn) (23)
- [Goal Components](#goal-components) (25)
- [Todo Components](#todo-components) (7)
- [Calendar Components](#calendar-components) (3)
- [Context Components](#context-components) (5)
- [Dashboard Components](#dashboard-components) (6)
- [Category Components](#category-components) (6)
- [Layout Components](#layout-components) (5)
- [Command Palette](#command-palette) (3)
- [Onboarding](#onboarding) (5)
- [PWA](#pwa) (4)
- [Providers](#providers) (2)
- [Settings](#settings) (3)

---

## UI Primitives (shadcn)

Base primitives generated via shadcn CLI. Do not modify these unless you are explicitly customizing the design system. Location: `components/ui/`.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| AlertDialog | `components/ui/alert-dialog.tsx` | Confirmation dialog for destructive actions | Delete dialogs (goal, category, todo) | Root, Trigger, Content, Action, Cancel |
| Badge | `components/ui/badge.tsx` | Inline label for status, priority, counts | Goal status, priority badges, filter counts | `variant: "default" \| "secondary" \| "destructive" \| "outline"` |
| Button | `components/ui/button.tsx` | Primary action button with variants | Everywhere | `variant`, `size`, `disabled`, `onClick` |
| Card | `components/ui/card.tsx` | Container with border, padding, shadow | Dashboard widgets, settings sections | Card, CardHeader, CardTitle, CardContent, CardFooter |
| Collapsible | `components/ui/collapsible.tsx` | Show/hide content with animation | Goal tree nodes, category tree, SMART fields | Root, Trigger, Content |
| Command | `components/ui/command.tsx` | Cmd+K style command list | Command palette | CommandInput, CommandList, CommandItem, CommandGroup |
| Dialog | `components/ui/dialog.tsx` | Modal overlay for create/edit flows | Goal modal, category form, onboarding | Root, Trigger, Content, Header, Title, Description, Footer |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | Context menu / action menu | Bulk bars, overflow menus, theme toggle | Root, Trigger, Content, Item, Separator |
| Input | `components/ui/input.tsx` | Single-line text input | Quick-add, detail panels, forms | `type`, `value`, `onChange`, `placeholder`, `disabled` |
| InputGroup | `components/ui/input-group.tsx` | Input with prefixed/suffixed icons or buttons | Search inputs, quick-add with icon | Root, Prefix, Input, Suffix |
| Label | `components/ui/label.tsx` | Form label with `htmlFor` | Forms, detail panels | `htmlFor`, children |
| Popover | `components/ui/popover.tsx` | Positioned floating content | Date picker, color picker, icon picker | Root, Trigger, Content |
| Select | `components/ui/select.tsx` | Dropdown select for enums | Filter bars, status/priority selects | Root, Trigger, Content, Item, Value |
| Separator | `components/ui/separator.tsx` | Horizontal or vertical divider | Detail panels between sections | `orientation` |
| Sheet | `components/ui/sheet.tsx` | Slide-in panel (mobile detail, progress history) | Mobile detail panels, progress history sheet | Root, Trigger, Content, Header, Title, Description |
| Sidebar | `components/ui/sidebar.tsx` | Shell for the two-panel layout (SidebarProvider, SidebarInset, etc.) | `app/(app)/layout.tsx`, `app-sidebar.tsx` | Provider, Inset, Header, Content, Footer, Trigger |
| Skeleton | `components/ui/skeleton.tsx` | Loading placeholder | Every detail panel and list while loading | `className` for sizing |
| Sonner | `components/ui/sonner.tsx` | Toaster mount for `sonner` notifications | Root layout | Toaster (used once) |
| Table | `components/ui/table.tsx` | Styled table primitives | Goal list view, todo list view | Table, THead, TBody, Tr, Th, Td |
| Tabs | `components/ui/tabs.tsx` | Tab switcher | Settings sections | Root, List, Trigger, Content |
| Textarea | `components/ui/textarea.tsx` | Multi-line text input | Goal description, SMART fields, context editor | `value`, `onChange`, `rows` |
| Tooltip | `components/ui/tooltip.tsx` | Hover help text | Icon-only buttons, status indicators | Provider, Root, Trigger, Content |
| XpProgressBar | `components/ui/xp-progress-bar.tsx` | Animated XP progress bar with level | Dashboard streaks widget | `xp`, `level`, `nextLevelXp` |

---

## Goal Components

Location: `components/goals/`. The largest module in the app. Note that `goal-board-card.tsx`, `goal-board-column.tsx`, and `goal-board-view.tsx` are dead code (board view was removed from the view switcher).

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| ChildrenList | `components/goals/children-list.tsx` | Renders the child goals of a parent with add-child action | `goal-detail.tsx` | `parentId`, `children: TreeGoal[]` |
| DndGoalProvider | `components/goals/dnd-goal-provider.tsx` | DnD-kit provider for goal reordering | `goal-list-view.tsx`, `goal-tree-view.tsx` | `onReorder(goalId, newIndex)` |
| GoalBoardCard (DEAD) | `components/goals/goal-board-card.tsx` | Board view card (unused; view removed) | Nowhere | Dead code |
| GoalBoardColumn (DEAD) | `components/goals/goal-board-column.tsx` | Board view column (unused) | Nowhere | Dead code |
| GoalBoardView (DEAD) | `components/goals/goal-board-view.tsx` | Board view container (unused) | Nowhere | Dead code |
| GoalDeleteDialog | `components/goals/goal-delete-dialog.tsx` | Confirmation dialog for deleting a goal | `goal-detail.tsx` | `goalId`, `open`, `onOpenChange`, `onDeleted` |
| GoalDetail | `components/goals/goal-detail.tsx` | Canonical detail panel with click-to-edit, SMART fields, progress, delete | `app/(app)/goals/page.tsx`, calendar day detail | `goalId`, `onClose`, `isMobileOverlay?` |
| GoalDragOverlay | `components/goals/goal-drag-overlay.tsx` | DnD visual overlay during drag | `dnd-goal-provider.tsx` | `goal: TreeGoal` |
| GoalFilterBar | `components/goals/goal-filter-bar.tsx` | Canonical filter bar wired to `useUIStore` | Goals page | None (reads/writes Zustand) |
| GoalForm | `components/goals/goal-form.tsx` | Create/edit form rendered inside the modal | `goal-modal.tsx` | `mode: "create" \| "edit"`, `initialData?`, `onSuccess` |
| GoalListColumns | `components/goals/goal-list-columns.tsx` | Column definitions for the goal list view (sortable headers) | `goal-list-view.tsx` | Column config exports |
| GoalListView | `components/goals/goal-list-view.tsx` | Table-style list view of goals with sorting and selection | Goals page | `goals: Goal[]`, selection from `useUIStore` |
| GoalModal | `components/goals/goal-modal.tsx` | Shared create/edit modal wrapping GoalForm | Root layout (mounted once) | Controlled via `useUIStore.goalModal` |
| GoalParentSelect | `components/goals/goal-parent-select.tsx` | Combobox for selecting a parent goal (respects horizon hierarchy) | `goal-form.tsx`, `goal-detail.tsx` | `value`, `onChange`, `currentGoalId?`, `horizon` |
| GoalPriorityBadge | `components/goals/goal-priority-badge.tsx` | Colored badge for LOW/MEDIUM/HIGH | `goal-detail.tsx`, `goal-list-view.tsx` | `priority: "LOW" \| "MEDIUM" \| "HIGH"` |
| GoalStatusSelect | `components/goals/goal-status-select.tsx` | Inline select for goal status (NOT_STARTED, IN_PROGRESS, COMPLETED, PAUSED) | `goal-detail.tsx`, `goal-list-view.tsx` | `goalId`, `currentStatus`, `onChange?` |
| GoalTimelineNode | `components/goals/goal-timeline-node.tsx` | Individual Gantt bar for a goal on the timeline | `goal-timeline-view.tsx` | `goal`, `startX`, `widthPx`, `row` |
| GoalTimelineView | `components/goals/goal-timeline-view.tsx` | Gantt-style timeline view | Goals page (via view switcher) | `goals: Goal[]` |
| GoalTreeNode | `components/goals/goal-tree-node.tsx` | Recursive node in the tree view with collapse | `goal-tree-view.tsx` | `goal: TreeGoal`, `depth` |
| GoalTreeView | `components/goals/goal-tree-view.tsx` | Hierarchical tree view of goals | Goals page (via view switcher) | `tree: TreeGoal[]` |
| GoalViewSwitcher | `components/goals/goal-view-switcher.tsx` | Toggle between List, Tree, Timeline (Board removed) | Goals page header | Reads/writes `useUIStore.activeView` |
| ProgressHistorySheet | `components/goals/progress-history-sheet.tsx` | Slide-in sheet showing progress log entries for a goal | `goal-detail.tsx` | `goalId`, `open`, `onOpenChange` |
| ProgressIncrement | `components/goals/progress-increment.tsx` | Inline input for adding progress with quick increments | `goal-detail.tsx` | `goalId`, `currentValue`, `targetValue`, `unit` |
| QuickAdd | `components/goals/quick-add.tsx` | Canonical inline goal creation input | Goals page header | `defaultHorizon?`, `defaultCategoryId?`, `defaultParentId?` |
| SortableHeader | `components/goals/sortable-header.tsx` | Reusable sortable column header for tables | `goal-list-view.tsx`, `todo-list-view.tsx` | `column`, `label`, `sortKey` |

---

## Todo Components

Location: `components/todos/`. Seven focused components.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| TodoBulkBar | `components/todos/todo-bulk-bar.tsx` | Action bar visible when todos are multi-selected | `todo-list-view.tsx` | `selectedIds: string[]`, `onClearSelection`, `onBulkComplete`, `onBulkDelete` |
| TodoDetail | `components/todos/todo-detail.tsx` | Canonical todo detail panel with completion, recurring, streak | Todos page, calendar day detail | `todoId`, `onClose`, `isMobileOverlay?` |
| TodoFilterBar | `components/todos/todo-filter-bar.tsx` | Filter bar for todos wired to `useUIStore` | Todos page | `showCompleted`, `status`, `priority`, `categoryId` (from store) |
| TodoListColumns | `components/todos/todo-list-columns.tsx` | Column definitions for the todo list | `todo-list-view.tsx` | Column config exports |
| TodoListView | `components/todos/todo-list-view.tsx` | Table view of todos with checkbox, selection, inline completion | Todos page | `todos: Todo[]` |
| TodoOverdueActions | `components/todos/todo-overdue-actions.tsx` | Action menu for overdue todos (reschedule, complete, delete) | `todo-detail.tsx`, dashboard overdue widget | `todo: Todo` |
| TodoQuickAdd | `components/todos/todo-quick-add.tsx` | Canonical inline todo creation input | Todos page, calendar day detail | `defaultDate?`, `defaultGoalId?`, `defaultCategoryId?` |

---

## Calendar Components

Location: `components/calendar/`. Three components covering month grid, day detail, and morning planning.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| CalendarDayDetail | `components/calendar/calendar-day-detail.tsx` | Selected-day detail showing todos + goal deadlines, supports inline editing | `app/(app)/calendar/page.tsx` | `date: Date`, `onClose` |
| CalendarMonthGrid | `components/calendar/calendar-month-grid.tsx` | Month grid with day cells, event clipping, today highlight | `app/(app)/calendar/page.tsx` | `currentMonth: Date`, `onDaySelect(date)`, `selectedDate?` |
| MorningPlanningPrompt | `components/calendar/morning-planning-prompt.tsx` | Dismissible banner prompting Big 3 planning each morning | `app/(app)/calendar/page.tsx`, dashboard | `onDismiss` |

---

## Context Components

Location: `components/context/`. Five components for the context knowledge base (markdown + tags + wikilinks + full-text search).

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| ContextCategoryTree | `components/context/context-category-tree.tsx` | Category filter tree on the context page | `app/(app)/context/page.tsx` | `selectedCategoryId?`, `onSelect(id)` |
| ContextEntryDetail | `components/context/context-entry-detail.tsx` | Canonical context entry viewer with rendered markdown, tags, backlinks | Context page | `entryId`, `onClose`, `onEdit` |
| ContextEntryEditor | `components/context/context-entry-editor.tsx` | Markdown editor for create/edit with tag input | Context page (via modal or edit mode) | `mode: "create" \| "edit"`, `initialData?`, `onSave` |
| ContextEntryList | `components/context/context-entry-list.tsx` | Scrollable list of context entries with preview | Context page | `entries: ContextEntry[]`, `selectedId?`, `onSelect(id)` |
| ContextSearch | `components/context/context-search.tsx` | Full-text search input using the raw-SQL `search_vector` column | Context page header | `onQueryChange(query)` |

---

## Dashboard Components

Location: `components/dashboard/`. Six components: the page container and five widgets.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| DashboardPage | `components/dashboard/dashboard-page.tsx` | Container rendering all five widgets in a responsive grid | `app/(app)/dashboard/page.tsx` | None |
| ProgressOverviewWidget | `components/dashboard/progress-overview-widget.tsx` | Aggregate progress across active goals | DashboardPage | `data: DashboardData` |
| StreaksStatsWidget | `components/dashboard/streaks-stats-widget.tsx` | XP, level, current streak, longest streak, with `XpProgressBar` | DashboardPage | `stats: UserStats` |
| TodaysBig3Widget | `components/dashboard/todays-big3-widget.tsx` | Today's Big 3 todos with inline completion | DashboardPage | `big3: Todo[]` |
| UpcomingDeadlinesWidget | `components/dashboard/upcoming-deadlines-widget.tsx` | Goals with deadlines in the next 7 days | DashboardPage | `deadlines: Goal[]` |
| WeeklyFocusWidget | `components/dashboard/weekly-focus-widget.tsx` | Weekly goals and their status | DashboardPage | `weeklyGoals: Goal[]` |

---

## Category Components

Location: `components/categories/`. Six components for managing the shared taxonomy.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| CategoryColorPicker | `components/categories/category-color-picker.tsx` | Grid of preset colors with custom hex input | `category-form.tsx` | `value: string`, `onChange(color)` |
| CategoryDeleteDialog | `components/categories/category-delete-dialog.tsx` | Confirmation dialog with warning about orphaned children | `category-manage-dialog.tsx` | `categoryId`, `open`, `onOpenChange`, `onDeleted` |
| CategoryForm | `components/categories/category-form.tsx` | Create/edit form for categories (name, icon, color, parent) | `category-manage-dialog.tsx` | `mode`, `initialData?`, `parentId?`, `onSuccess` |
| CategoryIconPicker | `components/categories/category-icon-picker.tsx` | Lucide icon picker with search | `category-form.tsx` | `value: string`, `onChange(iconName)` |
| CategoryManageDialog | `components/categories/category-manage-dialog.tsx` | Full category management dialog (tree, create, edit, delete) | `app-sidebar.tsx`, settings | `open`, `onOpenChange` |
| SidebarCategoryTree | `components/categories/sidebar-category-tree.tsx` | Collapsible category tree rendered in the sidebar | `app-sidebar.tsx` | None (fetches via `useCategories`) |

---

## Layout Components

Location: `components/layout/`. Five files that compose the app shell.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| AppSidebar | `components/layout/app-sidebar.tsx` | Main sidebar with nav links, category tree, user controls | `app/(app)/layout.tsx` | None |
| BottomTabBar | `components/layout/bottom-tab-bar.tsx` | Mobile bottom navigation bar | `app/(app)/layout.tsx` (mobile) | None |
| MobileDrawer | `components/layout/mobile-drawer.tsx` | Mobile slide-out menu with sidebar contents | `app/(app)/layout.tsx` (mobile) | `open`, `onOpenChange` |
| nav-config | `components/layout/nav-config.ts` | Navigation items configuration (not a component, a data export) | AppSidebar, BottomTabBar | Exports `NAV_ITEMS: NavItem[]` |
| ThemeToggle | `components/layout/theme-toggle.tsx` | Light/dark mode switch using `next-themes` | AppSidebar | None |

---

## Command Palette

Location: `components/command-palette/`. Three files for the Cmd+K palette.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| command-actions | `components/command-palette/command-actions.ts` | Action definitions (create goal, create todo, navigate, search, etc.) | `command-palette.tsx` | Exports `COMMAND_ACTIONS: CommandAction[]` |
| CommandPalette | `components/command-palette/command-palette.tsx` | Cmd+K palette with search across goals, todos, context, actions | `app/(app)/layout.tsx` | None (mounted globally) |
| KeyboardShortcuts | `components/command-palette/keyboard-shortcuts.tsx` | Global keyboard shortcut registration (Cmd+K, ?, etc.) | `app/(app)/layout.tsx` | None |

---

## Onboarding

Location: `components/onboarding/`. Five components for first-run experience.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| ContextualHints | `components/onboarding/contextual-hints.tsx` | In-app hints that appear contextually for new users | Pages | None |
| OnboardingChoice | `components/onboarding/onboarding-choice.tsx` | Template selection during onboarding (blank, personal, fitness, etc.) | `onboarding-wizard.tsx` | `onChoose(template)` |
| OnboardingGate | `components/onboarding/onboarding-gate.tsx` | Blocks the app until onboarding is completed | `app/(app)/layout.tsx` | `children` |
| OnboardingMcpGuide | `components/onboarding/onboarding-mcp-guide.tsx` | Guide for connecting an MCP client to Ascend | `onboarding-wizard.tsx`, settings | None |
| OnboardingWizard | `components/onboarding/onboarding-wizard.tsx` | Step-by-step first-run wizard | `onboarding-gate.tsx` | `onComplete` |

---

## PWA

Location: `components/pwa/`. Four files. Note: offline sync is scaffolded but incomplete (writes while offline are lost).

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| InstallPrompt | `components/pwa/install-prompt.tsx` | PWA install banner for supported browsers | Root layout | None |
| OfflineIndicator | `components/pwa/offline-indicator.tsx` | Shows a banner when the browser is offline | Root layout | None |
| OfflineSyncProvider (INCOMPLETE) | `components/pwa/offline-sync-provider.tsx` | Offline queue provider (not wired to mutations) | Root layout | `children` |
| SwRegistration | `components/pwa/sw-registration.tsx` | Registers the service worker | Root layout | None |

---

## Providers

Location: `components/providers/`. Two global providers.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| QueryProvider | `components/providers/query-provider.tsx` | TanStack Query provider with devtools | Root layout | `children` |
| ThemeProvider | `components/providers/theme-provider.tsx` | `next-themes` provider for light/dark mode | Root layout | `children` |

---

## Settings

Location: `components/settings/`. Three sections for the settings page.

| Component | File | Purpose | Used by | Key Props |
|-----------|------|---------|---------|-----------|
| ApiKeySection | `components/settings/api-key-section.tsx` | Shows and manages the user's API key | `app/(app)/settings/page.tsx` | None |
| ExportSection | `components/settings/export-section.tsx` | Export data as JSON, CSV, or DOCX | `app/(app)/settings/page.tsx` | None |
| ImportSection | `components/settings/import-section.tsx` | Import data from JSON | `app/(app)/settings/page.tsx` | None |

---

## How to Use This Catalog

1. **Before creating a new component**, search this catalog for the closest match.
2. **If a similar component exists**, read its source to see whether you can reuse, extend, or copy its pattern.
3. **If you need to modify an existing component**, check the "Used by" column to understand the blast radius.
4. **If you add a new component**, update this catalog in the same commit so the next developer knows it exists.

## Known Duplication Risks

- Detail panels (`goal-detail`, `todo-detail`, `context-entry-detail`) all follow the click-to-edit pattern. If you need another detail panel, copy `goal-detail.tsx` as the base.
- Quick-add inputs (`quick-add.tsx`, `todo-quick-add.tsx`) share a pattern. If you need a new quick-add for another entity, copy `quick-add.tsx`.
- Filter bars (`goal-filter-bar.tsx`, `todo-filter-bar.tsx`) both read from Zustand. Copy `goal-filter-bar.tsx` as the base.
- Sortable headers are already extracted to `sortable-header.tsx`. Do not re-implement.

## Dead Code (do not extend)

- `components/goals/goal-board-card.tsx`
- `components/goals/goal-board-column.tsx`
- `components/goals/goal-board-view.tsx`

The board view was removed from `goal-view-switcher.tsx`. These files remain in the repo but are not imported anywhere. Do not treat them as active patterns.

## Incomplete / Do Not Promote

- `components/pwa/offline-sync-provider.tsx` and the `lib/offline/outbox.ts` queue it depends on are not wired to any mutation. Offline writes are lost. Do not build UI that implies offline persistence works until the queue is connected.
