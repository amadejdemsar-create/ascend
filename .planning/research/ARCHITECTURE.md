# Architecture: v2.0 Inputs & Outputs Integration

**Domain:** To-dos (inputs), calendar view, context system integrating into existing goal tracking app
**Researched:** 2026-04-08
**Scope:** Integration architecture ONLY. How new features attach to existing code.

## Existing Architecture Summary

The current Ascend app follows a clean layered pattern:

```
Browser / MCP Clients
        |
  API Route Handlers (/api/*)    <-- Zod validation, auth, thin handlers
        |
  Service Layer (lib/services/)  <-- Plain TS objects, business logic
        |
  Prisma Client (lib/db.ts)     <-- PrismaPg adapter, singleton
        |
  PostgreSQL
```

**Existing models:** User, Goal, Category, ProgressLog, UserStats, XpEvent
**Existing views:** Cards, List, Tree, Timeline (in ViewType union)
**Existing nav:** Dashboard, Goals, Settings (in nav-config.ts)
**Existing MCP tools:** 22 tools across 6 handler files
**State management:** Zustand (UI state with localStorage persist), React Query (server state)
**Key pattern:** Service layer shared between API routes and MCP tools. Zero duplication.

---

## 1. Data Model Changes

### 1a. New Model: Todo

To-dos are inputs (actions you control). Goals are outputs (results you want). They are separate entities, not a subtype of Goal. A to-do can optionally link to a goal (showing the "why" behind the "what"), but many to-dos will be standalone.

```prisma
enum TodoStatus {
  PENDING
  DONE
  SKIPPED
}

model Todo {
  id           String     @id @default(cuid())
  userId       String
  title        String
  notes        String?
  status       TodoStatus @default(PENDING)
  priority     Priority   @default(MEDIUM)

  // Link to goal (optional: connects input to output)
  goalId       String?
  goal         Goal?      @relation(fields: [goalId], references: [id], onDelete: SetNull)

  // Category (reuses existing Category model)
  categoryId   String?
  category     Category?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // Scheduling
  dueDate      DateTime?           // When this todo should be done (date only, no time)
  scheduledDate DateTime?          // When the user plans to work on it (for calendar placement)

  // Recurring (habit) support
  isRecurring          Boolean              @default(false)
  recurringFrequency   RecurringFrequency?
  recurringInterval    Int?                 @default(1)
  recurringSourceId    String?
  recurringSource      Todo?                @relation("RecurringTodos", fields: [recurringSourceId], references: [id], onDelete: SetNull)
  recurringInstances   Todo[]               @relation("RecurringTodos")
  currentStreak        Int                  @default(0)
  longestStreak        Int                  @default(0)
  lastCompletedInstance DateTime?

  // Ordering
  sortOrder    Int        @default(0)

  // Timestamps
  completedAt  DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  // Relations
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([goalId])
  @@index([categoryId])
  @@index([dueDate])
  @@index([scheduledDate])
  @@index([status, userId])
  @@index([recurringSourceId])
}
```

**Why separate from Goal, not a flag on Goal:** Goals have SMART fields, hierarchy (parentId, horizon), progress tracking (currentValue/targetValue/progressLogs), and a four-tier cascade. To-dos have none of that. Cramming both concepts into Goal would bloat the model with nullable fields, make queries slower, and confuse the mental model. A `goalId` FK is the clean bridge between inputs and outputs.

**Why `scheduledDate` separate from `dueDate`:** A to-do might be due Friday but the user schedules it for Wednesday on their calendar. The calendar view needs the scheduled date for placement; the deadline widget needs the due date.

### 1b. New Model: ContextEntry

Context is structured personal knowledge that AI can query via MCP. Each entry is a key-value pair within a namespace, making it queryable by topic.

```prisma
model ContextEntry {
  id          String   @id @default(cuid())
  userId      String
  namespace   String                // e.g., "personal", "work", "health", "preferences"
  key         String                // e.g., "daily_routine", "tech_stack", "dietary_restrictions"
  value       String                // The actual content (plain text, can be long)
  metadata    String?               // Optional JSON string for structured metadata

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, namespace, key])
  @@index([userId])
  @@index([userId, namespace])
}
```

**Why key-value in a namespace, not freeform documents:** The primary consumer is AI via MCP. AI needs to ask "what does this user prefer for dinner?" or "what is their work schedule?" A namespace/key structure lets MCP tools query precisely (`get_context(namespace: "health", key: "dietary_restrictions")`) or list all entries in a namespace. Freeform documents would require full-text search and semantic matching, which is overkill for a personal knowledge store.

**Why value is a plain String, not JSON:** Context values are primarily consumed by AI as readable text. Forcing JSON structure would create friction when the user just wants to write "I prefer TypeScript with functional patterns" via MCP. The optional `metadata` field handles cases where structured data is useful alongside the text.

### 1c. Modifications to Existing Models

**User model** additions:
```prisma
model User {
  // ... existing fields ...
  todos          Todo[]
  contextEntries ContextEntry[]
}
```

**Goal model** addition:
```prisma
model Goal {
  // ... existing fields ...
  todos   Todo[]   // To-dos linked to this goal
}
```

**Category model** addition:
```prisma
model Category {
  // ... existing fields ...
  todos   Todo[]   // To-dos in this category
}
```

These are relation-only changes. No new columns on existing tables, just Prisma relation fields that add no migration cost.

---

## 2. Service Layer Additions

Follow the existing pattern: plain TS object modules in `lib/services/`.

### 2a. todo-service.ts (NEW)

```typescript
// lib/services/todo-service.ts
export const todoService = {
  async list(userId: string, filters?: TodoFilters, pagination?) { ... },
  async create(userId: string, data: CreateTodoInput) { ... },
  async getById(userId: string, id: string) { ... },
  async update(userId: string, id: string, data: UpdateTodoInput) { ... },
  async delete(userId: string, id: string) { ... },
  async complete(userId: string, id: string) { ... },     // Sets status=DONE, completedAt, awards XP, handles streaks
  async skip(userId: string, id: string) { ... },         // Sets status=SKIPPED (no XP, breaks streak)
  async bulkComplete(userId: string, ids: string[]) { ... },
  async getByDate(userId: string, date: Date) { ... },    // For calendar day view
  async getByDateRange(userId: string, start: Date, end: Date) { ... }, // For calendar month view
  async reorder(userId: string, items: { id: string; sortOrder: number }[]) { ... },
  async getTop3(userId: string, date?: Date) { ... },     // Today's top 3 priorities
};
```

**Integration with gamification:** `complete()` calls `gamificationService.awardXp()` using the same caller-responsible pattern as goal completion. To-do XP values should be lower than goals (suggested: 10 base, with priority multiplier).

**Integration with recurring service:** Create a `todo-recurring-service.ts` that mirrors the existing `recurring-service.ts` pattern but operates on Todo instances instead of Goal instances. The streak tracking logic (grace periods, instance generation) is identical.

### 2b. context-service.ts (NEW)

```typescript
// lib/services/context-service.ts
export const contextService = {
  async get(userId: string, namespace: string, key: string) { ... },
  async set(userId: string, namespace: string, key: string, value: string, metadata?: string) { ... }, // Upsert
  async delete(userId: string, namespace: string, key: string) { ... },
  async listNamespaces(userId: string) { ... },           // List all namespaces
  async listKeys(userId: string, namespace: string) { ... }, // List all keys in namespace
  async search(userId: string, query: string) { ... },    // Search across all values
  async getAll(userId: string, namespace?: string) { ... }, // Dump all or by namespace
};
```

**Upsert pattern for `set()`:** Use Prisma's `upsert` with the `@@unique([userId, namespace, key])` constraint. This means `set_context` in MCP is idempotent: calling it again with the same namespace/key overwrites the value.

### 2c. dashboard-service.ts (MODIFY)

Add to the existing `getDashboardData()` method:

```typescript
// New parallel query in batch 1:
const todaysTodos = prisma.todo.findMany({
  where: {
    userId,
    OR: [
      { scheduledDate: { gte: startOfDay(now), lte: endOfDay(now) } },
      { dueDate: { gte: startOfDay(now), lte: endOfDay(now) }, scheduledDate: null },
    ],
    status: "PENDING",
  },
  orderBy: [{ priority: "desc" }, { sortOrder: "asc" }],
  take: 10,
  include: { category: true, goal: { select: { id: true, title: true } } },
});
```

Add `todaysTodos` and `top3Inputs` to the DashboardData interface. The dashboard becomes the "what are my inputs today?" view.

---

## 3. Validation Schemas (lib/validations.ts additions)

```typescript
// New enums
export const todoStatusEnum = z.enum(["PENDING", "DONE", "SKIPPED"]);

// Todo schemas
export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().optional(),
  priority: priorityEnum.default("MEDIUM"),
  goalId: z.string().optional(),
  categoryId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  scheduledDate: z.string().datetime().optional(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: recurringFrequencyEnum.optional(),
  recurringInterval: z.number().int().min(1).optional(),
});

export const updateTodoSchema = createTodoSchema.partial().extend({
  status: todoStatusEnum.optional(),
  sortOrder: z.number().optional(),
});

export const todoFiltersSchema = z.object({
  status: todoStatusEnum.optional(),
  priority: priorityEnum.optional(),
  categoryId: z.string().optional(),
  goalId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  scheduledDate: z.string().datetime().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Context schemas
export const contextEntrySchema = z.object({
  namespace: z.string().min(1).max(100),
  key: z.string().min(1).max(200),
  value: z.string().min(1),
  metadata: z.string().optional(),
});

export const contextQuerySchema = z.object({
  namespace: z.string().optional(),
  key: z.string().optional(),
  query: z.string().optional(),
});
```

---

## 4. API Routes

### 4a. New Routes

Following the existing thin handler pattern (auth + parse + service + respond):

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/todos` | GET, POST | List (with filters via query params) and create todos |
| `/api/todos/[id]` | GET, PATCH, DELETE | Single todo CRUD |
| `/api/todos/[id]/complete` | POST | Complete a todo (separate endpoint for side effects) |
| `/api/todos/[id]/skip` | POST | Skip a todo |
| `/api/todos/reorder` | POST | Batch reorder |
| `/api/todos/bulk-complete` | POST | Complete multiple todos |
| `/api/todos/top3` | GET | Today's top 3 priority inputs |
| `/api/todos/by-date` | GET | Todos for a specific date (calendar day) |
| `/api/todos/by-range` | GET | Todos for a date range (calendar month) |
| `/api/todos/recurring/generate` | POST | Generate due recurring todo instances |
| `/api/context` | GET, POST | List/search and upsert context entries |
| `/api/context/[namespace]` | GET | List all entries in a namespace |
| `/api/context/[namespace]/[key]` | GET, PUT, DELETE | Single context entry CRUD |

### 4b. Modified Routes

| Route | Change |
|-------|--------|
| `/api/dashboard` | Add `todaysTodos` and `top3Inputs` to response |
| `/api/goals/[id]` | Include `todos` relation in GET response (count or list of linked todos) |

---

## 5. MCP Tool Additions

### 5a. New Tool Handler Files

**`lib/mcp/tools/todo-tools.ts`** (NEW):

| Tool | Description |
|------|-------------|
| `create_todo` | Create a to-do with optional goal link, category, due/scheduled dates |
| `get_todo` | Get a single to-do by ID |
| `update_todo` | Update any fields on a to-do |
| `delete_todo` | Delete a to-do |
| `list_todos` | List todos with filters (status, priority, category, goal, date range) |
| `complete_todo` | Mark a to-do as done (triggers XP, streak updates) |
| `skip_todo` | Mark a to-do as skipped |
| `complete_todos` | Bulk complete multiple todos |
| `get_todays_inputs` | Get today's pending todos sorted by priority |
| `get_top3` | Get the top 3 priority inputs for today |

**`lib/mcp/tools/context-tools.ts`** (NEW):

| Tool | Description |
|------|-------------|
| `set_context` | Create or update a context entry (upsert by namespace + key) |
| `get_context` | Get a specific context entry by namespace and key |
| `delete_context` | Delete a context entry |
| `list_context` | List all entries, optionally filtered by namespace |
| `search_context` | Search context entries by text query |
| `list_namespaces` | List all namespaces for the user |

### 5b. Modifications to Existing MCP

**`lib/mcp/server.ts`:** Add two new tool name sets and route them:

```typescript
const TODO_TOOLS = new Set([
  "create_todo", "get_todo", "update_todo", "delete_todo",
  "list_todos", "complete_todo", "skip_todo", "complete_todos",
  "get_todays_inputs", "get_top3",
]);

const CONTEXT_TOOLS = new Set([
  "set_context", "get_context", "delete_context",
  "list_context", "search_context", "list_namespaces",
]);
```

**`lib/mcp/schemas.ts`:** Add tool definitions for all 16 new tools following the existing raw JSON Schema pattern.

**`lib/mcp/tools/dashboard-tools.ts`:** Update `get_dashboard` to include today's todos and top 3 inputs in the response.

**Tool count:** 22 existing + 10 todo + 6 context = 38 tools total.

---

## 6. UI Store Changes (lib/stores/ui-store.ts)

### 6a. ViewType Extension

```typescript
export type ViewType = "cards" | "list" | "tree" | "timeline" | "calendar";
```

Add `"calendar"` to the union. The view switcher on the goals page gains a calendar icon option.

### 6b. New State for Todos

Add to UIStore:

```typescript
interface UIStore {
  // ... existing ...

  // Todo state
  selectedTodoId: string | null;
  todoModalOpen: boolean;
  todoModalMode: "create" | "edit";

  // Calendar state
  calendarDate: Date;        // Currently viewed month
  calendarSelectedDate: Date | null; // Selected day

  // Actions
  selectTodo: (id: string | null) => void;
  openTodoModal: (mode: "create" | "edit") => void;
  closeTodoModal: () => void;
  setCalendarDate: (date: Date) => void;
  setCalendarSelectedDate: (date: Date | null) => void;
}
```

Bump persist version to 6 with migration adding the new defaults.

---

## 7. React Query Keys (lib/queries/keys.ts)

```typescript
export const queryKeys = {
  // ... existing ...
  todos: {
    all: () => ["todos"] as const,
    list: (filters?: TodoFilters) => ["todos", "list", filters] as const,
    detail: (id: string) => ["todos", "detail", id] as const,
    byDate: (date: string) => ["todos", "by-date", date] as const,
    byRange: (start: string, end: string) => ["todos", "by-range", start, end] as const,
    top3: () => ["todos", "top3"] as const,
    recurring: () => ["todos", "recurring"] as const,
  },
  context: {
    all: () => ["context"] as const,
    byNamespace: (ns: string) => ["context", ns] as const,
    entry: (ns: string, key: string) => ["context", ns, key] as const,
  },
};
```

---

## 8. Hooks (lib/hooks/)

### 8a. use-todos.ts (NEW)

Mirrors `use-goals.ts` pattern exactly:

```typescript
export function useTodos(filters?: TodoFilters) { ... }
export function useTodo(id: string) { ... }
export function useCreateTodo() { ... }
export function useUpdateTodo() { ... }
export function useDeleteTodo() { ... }
export function useCompleteTodo() { ... }        // POST to /complete, invalidates todos + dashboard
export function useSkipTodo() { ... }
export function useTodosByDate(date: string) { ... }
export function useTodosByRange(start: string, end: string) { ... }
export function useTop3Todos() { ... }
export function useReorderTodos() { ... }
```

All mutations invalidate `queryKeys.todos.all()` and `queryKeys.dashboard()`.

### 8b. use-context.ts (NEW)

```typescript
export function useContextEntries(namespace?: string) { ... }
export function useContextEntry(namespace: string, key: string) { ... }
export function useSetContext() { ... }           // Upsert mutation
export function useDeleteContext() { ... }
export function useSearchContext(query: string) { ... }
export function useContextNamespaces() { ... }
```

---

## 9. Component Structure

### 9a. New Components

```
components/
  todos/
    todo-card.tsx              # Single to-do item (checkbox + title + priority + linked goal)
    todo-list.tsx              # Scrollable list of to-do cards with DnD reorder
    todo-detail.tsx            # Detail panel (mirrors goal-detail.tsx pattern)
    todo-form.tsx              # Create/edit form (modal content)
    todo-modal.tsx             # Modal wrapper (mirrors goal-modal.tsx)
    todo-quick-add.tsx         # Inline add (mirrors quick-add.tsx pattern)
    todo-filter-bar.tsx        # Status, priority, category, goal filters
    top3-widget.tsx            # "Today's Top 3" compact widget for dashboard
  calendar/
    calendar-view.tsx          # Month grid + day detail (the primary component)
    calendar-grid.tsx          # Month grid with day cells
    calendar-day-cell.tsx      # Single day cell showing dot indicators and count
    calendar-day-detail.tsx    # Selected day's to-dos and goals with deadlines
    calendar-header.tsx        # Month/year navigation + today button
  context/
    context-page.tsx           # Full context management page
    context-namespace-list.tsx # Left panel: list of namespaces
    context-entry-list.tsx     # Entries in selected namespace
    context-entry-form.tsx     # Create/edit form for context entries
    context-search.tsx         # Search across all context
  dashboard/
    todays-inputs-widget.tsx   # NEW: Today's to-dos widget for dashboard
```

### 9b. Modified Components

| Component | Change |
|-----------|--------|
| `components/dashboard/dashboard-page.tsx` | Add TodaysInputsWidget and Top3Widget to the grid |
| `components/goals/goal-detail.tsx` | Add "Linked To-dos" section showing todos with goalId = this goal |
| `components/goals/goal-form.tsx` | No changes needed (todos link to goals, not the other way) |
| `components/layout/nav-config.ts` | Add Calendar and Context nav items |
| `components/layout/app-sidebar.tsx` | Renders new nav items automatically from config |
| `components/layout/bottom-tab-bar.tsx` | Renders new nav items automatically from config |
| `components/goals/goal-view-switcher.tsx` | Add calendar icon option |
| `components/command-palette/command-palette.tsx` | Add todo and context search/actions |
| `components/command-palette/command-actions.ts` | Add create-todo, search-context quick actions |

### 9c. New Pages

| Page | Route | Layout |
|------|-------|--------|
| `app/(app)/calendar/page.tsx` | `/calendar` | Month grid + day detail (two-panel like goals) |
| `app/(app)/todos/page.tsx` | `/todos` | Two-panel: list + detail (mirrors goals page layout) |
| `app/(app)/context/page.tsx` | `/context` | Two-panel: namespace list + entries |

---

## 10. Navigation Changes

**nav-config.ts** update:

```typescript
export const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inputs", href: "/todos", icon: CheckSquare },     // NEW
  { label: "Outputs", href: "/goals", icon: Target },          // Renamed from "Goals"
  { label: "Calendar", href: "/calendar", icon: Calendar },    // NEW
  { label: "Context", href: "/context", icon: Brain },         // NEW
  { label: "Settings", href: "/settings", icon: Settings },
];
```

**Rationale for naming:** "Inputs" and "Outputs" reinforce the core mental model. The goals page becomes "Outputs" and todos become "Inputs". This is a label change only; the URL `/goals` stays the same for backward compatibility with MCP tool references and bookmarks.

---

## 11. Calendar View Architecture

The calendar view is a new page, not another view mode on the goals page. It shows a combined view of both to-dos (inputs) and goals with deadlines (outputs).

### Layout

```
┌────────────────────────────────────────────────────────┐
│  < April 2026 >                            [Today]     │
├────────────────────────────────────────────────────────┤
│ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun         │
│  1   │  2   │  3   │  4   │  5   │  6   │  7          │
│ ●●   │  ●   │      │ ●●●  │  ●   │      │             │
│------│------│------│------│------│------│--------------│
│  8   │  9   │ ...                                      │
├────────────────────────────────────────────────────────┤
│ Selected: April 8, 2026                                │
│                                                        │
│ TOP 3 INPUTS                                           │
│ ☐ Write architecture doc (HIGH)  → Q2 Planning [goal]  │
│ ☐ Review PR #42 (MEDIUM)                               │
│ ☐ Grocery shopping (LOW)         → Health [category]   │
│                                                        │
│ ALL INPUTS (5)                                         │
│ ☐ ...remaining todos...                                │
│                                                        │
│ DEADLINES (2)                                          │
│ ◎ Q2 Revenue Target  (Quarterly, due today)            │
│ ◎ Blog post draft    (Weekly, due today)               │
└────────────────────────────────────────────────────────┘
```

### Data Flow

1. `calendar-view.tsx` fetches todos and goals for the visible month using `useTodosByRange()` and a new `useGoalsByDateRange()` hook
2. `calendar-grid.tsx` receives the data and renders day cells with dot indicators (colored by category)
3. Clicking a day sets `calendarSelectedDate` in Zustand, which renders `calendar-day-detail.tsx` below the grid (mobile) or beside it (desktop)
4. The day detail shows top 3 inputs prominently, then all other inputs, then goal deadlines
5. To-dos can be completed directly from the calendar day view (checkbox)

### Desktop vs Mobile

**Desktop:** Side-by-side layout. Calendar grid on the left, selected day detail on the right. Same two-panel pattern as goals page.

**Mobile:** Stacked. Calendar grid on top (compact, single row of dots per day), day detail below. Tap a day to scroll down to its details.

---

## 12. Dashboard Integration

The dashboard transforms from "what goals should I focus on?" to "what are my inputs today?"

### Updated Dashboard Layout

```
┌────────────────────────┬────────────────────────┐
│ TODAY'S TOP 3 INPUTS   │ WEEKLY FOCUS (outputs)  │
│ (NEW, prominent)       │ (existing, renamed)     │
├────────────────────────┼────────────────────────┤
│ PROGRESS OVERVIEW      │ STREAKS & STATS         │
│ (existing)             │ (existing, add todo     │
│                        │  streaks)               │
├────────────────────────┼────────────────────────┤
│ UPCOMING DEADLINES     │ TODAY'S INPUTS          │
│ (existing)             │ (NEW, full list)        │
└────────────────────────┴────────────────────────┘
```

The "Today's Top 3 Inputs" widget takes the top-left spot because the daily experience is input-centric. The existing "Weekly Focus" widget (goals) moves to the right, reinforcing that inputs drive outputs.

---

## 13. Context System Architecture

### User Interaction Points

1. **MCP (primary):** AI assistants set and query context through MCP tools. This is the expected primary usage pattern. The user tells their AI "I prefer TypeScript with functional patterns" and the AI calls `set_context(namespace: "preferences", key: "coding_style", value: "TypeScript with functional patterns")`.

2. **Web UI (secondary):** The context page lets users view, edit, and organize their context manually. Useful for auditing what AI has stored and making corrections.

3. **Dashboard (passive):** Context does not appear on the dashboard. It is background infrastructure that makes AI interactions smarter, not something the user actively checks daily.

### Default Namespaces

Seed these on user creation:

| Namespace | Purpose | Example Keys |
|-----------|---------|-------------|
| `personal` | About the user | `daily_routine`, `preferences`, `goals_philosophy` |
| `work` | Professional context | `role`, `company`, `team`, `tech_stack` |
| `health` | Health and fitness | `dietary_restrictions`, `exercise_routine`, `conditions` |
| `preferences` | General preferences | `communication_style`, `timezone`, `language` |

---

## 14. Data Flow: Todo Completion Lifecycle

```
User checks todo checkbox (or AI calls complete_todo)
        │
        ▼
  todoService.complete(userId, todoId)
        │
        ├── Set status = DONE, completedAt = now()
        │
        ├── If todo.isRecurring && todo.recurringSourceId:
        │     todoRecurringService.completeInstance(userId, todoId)
        │     └── Update template streak (currentStreak++, longestStreak)
        │
        ├── gamificationService.awardXp(userId, XP_PER_TODO[priority])
        │     └── Update UserStats (totalXp, level, weeklyScore)
        │
        └── Return completed todo + _xp + _streak metadata
        │
        ▼
  React Query invalidates: todos.all, dashboard
        │
        ▼
  UI updates: checkbox animates, XP toast, streak update
```

---

## 15. Interaction Map: What Touches What

### New Feature Impact on Existing Code

| Existing File | Change Type | What Changes |
|---------------|-------------|--------------|
| `prisma/schema.prisma` | ADD models + relations | Todo, ContextEntry models; relations on User, Goal, Category |
| `lib/validations.ts` | ADD schemas | Todo and Context Zod schemas and types |
| `lib/queries/keys.ts` | ADD keys | todos.* and context.* key factories |
| `lib/stores/ui-store.ts` | MODIFY | Add ViewType "calendar", todo/calendar state, bump persist version |
| `lib/constants.ts` | ADD | XP_PER_TODO values, TODO_STATUS constants |
| `lib/services/dashboard-service.ts` | MODIFY | Add today's todos query to getDashboardData() |
| `lib/services/gamification-service.ts` | MODIFY | Add todo completion XP (reuse existing awardXp, just different amounts) |
| `lib/mcp/server.ts` | MODIFY | Add TODO_TOOLS and CONTEXT_TOOLS routing |
| `lib/mcp/schemas.ts` | ADD | 16 new tool definitions |
| `components/layout/nav-config.ts` | MODIFY | Add Inputs, Calendar, Context nav items; rename Goals to Outputs |
| `components/dashboard/dashboard-page.tsx` | MODIFY | Add TodaysInputsWidget, reorder grid |
| `components/goals/goal-detail.tsx` | MODIFY | Add "Linked Todos" section |
| `components/command-palette/command-palette.tsx` | MODIFY | Add todo search, context search |
| `components/command-palette/command-actions.ts` | MODIFY | Add todo and context actions |
| `app/(app)/layout.tsx` | MODIFY | Add TodoModal to layout (mirrors GoalModal) |

### New Files (no existing code changes)

| Path | Purpose |
|------|---------|
| `lib/services/todo-service.ts` | Todo business logic |
| `lib/services/todo-recurring-service.ts` | Recurring todo instance generation and streaks |
| `lib/services/context-service.ts` | Context CRUD and search |
| `lib/hooks/use-todos.ts` | React Query hooks for todos |
| `lib/hooks/use-context.ts` | React Query hooks for context |
| `lib/mcp/tools/todo-tools.ts` | MCP tool handlers for todos |
| `lib/mcp/tools/context-tools.ts` | MCP tool handlers for context |
| `app/api/todos/*` | 8 API route files |
| `app/api/context/*` | 4 API route files |
| `app/(app)/todos/page.tsx` | Todos page |
| `app/(app)/calendar/page.tsx` | Calendar page |
| `app/(app)/context/page.tsx` | Context page |
| `components/todos/*` | 7 component files |
| `components/calendar/*` | 5 component files |
| `components/context/*` | 4 component files |
| `components/dashboard/todays-inputs-widget.tsx` | Dashboard widget |

---

## 16. Suggested Build Order

The build order respects dependencies: data layer before API before UI before integration.

### Phase 1: Todo Data Layer and API
**Creates:** Prisma migration, todo-service.ts, todo-recurring-service.ts, validations, API routes, query keys
**Depends on:** Nothing new (uses existing Prisma, auth patterns)
**Why first:** Everything else (UI, MCP, calendar, dashboard) depends on the todo data layer existing.

### Phase 2: Todo UI (List + Detail + Forms)
**Creates:** todo components, todos page, hooks, UIStore changes
**Depends on:** Phase 1 (API routes must exist)
**Why second:** Users need to see and interact with todos before calendar or MCP tools matter. Follow the same two-panel pattern as the goals page.

### Phase 3: Calendar View
**Creates:** calendar components, calendar page, date range queries
**Depends on:** Phase 1 (needs todo-by-range API), existing goals data
**Why third:** The calendar combines todos and goals by date. Both data sources must exist. This is the "primary daily experience" per the project vision.

### Phase 4: Dashboard Integration
**Creates:** todays-inputs-widget, dashboard modifications
**Depends on:** Phase 1 (needs todo data), Phase 2 (widget links to todos page)
**Why fourth:** Dashboard is the landing page. Adding the "Today's Inputs" widget transforms it from goal-centric to input-centric.

### Phase 5: Context System (Data Layer + MCP + UI)
**Creates:** context-service.ts, API routes, MCP tools, context page, hooks
**Depends on:** Nothing (independent of todos/calendar)
**Why fifth:** Context is fully independent of todos and calendar. It could technically run in parallel with Phases 2-4, but sequencing it last keeps focus on the core input/output transformation first. Context is primarily consumed by AI via MCP, so the web UI is secondary.

### Phase 6: Todo MCP Tools
**Creates:** todo-tools.ts, MCP schema additions, server routing
**Depends on:** Phase 1 (todo-service must exist)
**Why sixth:** MCP tools for todos follow after the web UI is stable. The AI should be able to create, complete, and query todos through the same service layer.

### Phase 7: Navigation and Polish
**Creates:** Nav config updates, command palette additions, view switcher calendar option, goal-detail linked todos section
**Depends on:** Phases 1-6 (all features must exist to navigate to them)
**Why last:** Polish and cross-cutting integration. Rename "Goals" to "Outputs" in nav, add "Inputs" tab, add calendar to view switcher, extend command palette with todo and context actions.

---

## 17. Patterns to Follow

### Pattern: Two-Panel Page Layout
Every content page in Ascend uses the same two-panel layout. The todos page and context page should replicate this exactly:

```tsx
<div className="flex h-full">
  {/* Left: List with filters */}
  <div className={`flex-1 flex flex-col border-r overflow-y-auto ${selected ? "hidden md:flex" : "flex"}`}>
    {/* Sticky header with title + filters */}
    {/* Scrollable content */}
  </div>
  {/* Right: Detail panel */}
  {selected ? <DetailPanel /> : <EmptyState />}
</div>
```

### Pattern: Service Layer Consistency
Every new service method follows: validate input (Zod) > check ownership (userId) > perform operation (Prisma) > return result. Side effects (XP, streaks) happen at the service layer, not in route handlers or MCP tools.

### Pattern: MCP Tool Handlers
Each tool handler file exports a single `handle*Tool()` function that switches on tool name, validates args with Zod, calls the service layer, and returns `{ content: [{ type: "text", text: JSON.stringify(result) }] }`.

### Pattern: React Query Cache Invalidation
Mutations invalidate the broadest relevant cache. Todo mutations invalidate `queryKeys.todos.all()` and `queryKeys.dashboard()`. Context mutations invalidate `queryKeys.context.all()`.

---

## 18. Anti-Patterns to Avoid

### Anti-Pattern: Overloading the Goal Model
Do not add `isTodo` boolean to Goal. Do not create todos as goals with `horizon: "DAILY"`. The mental models are fundamentally different: goals have hierarchy, progress tracking, SMART fields. Todos are flat, simple, completion-oriented. Keep them separate with a goalId FK bridge.

### Anti-Pattern: Calendar as View Mode on Goals Page
The calendar is its own page, not another view mode on the goals page. It combines data from both todos AND goals, which makes it a cross-cutting view. Adding it as a ViewType on the goals page would mean the goals page needs to fetch and render todo data, violating its single responsibility.

### Anti-Pattern: Complex Context Storage
Do not build a document database or rich text editor for context. The namespace/key/value pattern is intentionally simple. AI tools work better with discrete, queryable facts than with long documents. If the user needs rich knowledge management, that is Notion/Obsidian territory.

### Anti-Pattern: Shared Recurring Service
Do not try to make a generic recurring service that handles both Goals and Todos polymorphically. The two models have different fields, different completion side effects, and different streak semantics. Two separate but structurally similar services (recurring-service.ts for goals, todo-recurring-service.ts for todos) are clearer and more maintainable than a generic abstraction.

---

## Sources

- Existing codebase analysis (HIGH confidence): All architectural decisions are derived directly from reading the current code
- Prisma 7 self-relations and upsert patterns (HIGH confidence): Already proven in the existing Goal and Category models
- MCP SDK patterns (HIGH confidence): Already working in `lib/mcp/server.ts` with 22 tools
- date-fns date range queries (HIGH confidence): Already used in dashboard-service.ts
- React Query invalidation patterns (HIGH confidence): Already established in use-goals.ts
