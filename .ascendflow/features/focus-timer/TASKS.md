# Implementation Tasks: Focus Timer

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Schema + validation

- [ ] Add `FocusSession` model to `prisma/schema.prisma` (see PRD for exact shape). Add `focusSessions FocusSession[]` to the User, Todo, and Goal models.

- [ ] Run `npx prisma migrate dev --name add_focus_sessions` to generate the migration.

- [ ] Run `npx prisma generate` to update the client (migrate dev usually does this automatically; verify).

- [ ] Add Zod schemas to `lib/validations.ts`:
  ```ts
  export const createFocusSessionSchema = z.object({
    todoId: z.string().optional(),
    durationSeconds: z.number().int().positive(),
    mode: z.enum(["focus", "break"]),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
  });
  export type CreateFocusSessionInput = z.infer<typeof createFocusSessionSchema>;
  
  export const focusSessionFiltersSchema = z.object({
    todoId: z.string().optional(),
    goalId: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  });
  export type FocusSessionFilters = z.infer<typeof focusSessionFiltersSchema>;
  ```

## Phase 2: Service layer

- [ ] Create `lib/services/focus-service.ts`. Follow the const object pattern. Methods:
  - `create(userId, data)`: if `todoId` set, look up the todo's `goalId` to denormalize. Insert the FocusSession. Return it.
  - `list(userId, filters)`: query with optional filters, ordered by `startedAt` desc.
  - `summaryForTodo(userId, todoId)`: `prisma.focusSession.aggregate({ where: { userId, todoId, mode: "focus" }, _sum: { durationSeconds: true }, _count: { id: true } })` → return `{ totalSeconds, sessionCount }`.
  - `summaryForGoal(userId, goalId)`: same shape, filter by goalId.
  - `summaryForWeek(userId)`: date range = current Monday to now, filter `mode: "focus"`, sum durationSeconds.

  Every query includes `userId`. Follow the ownership-check pattern.

## Phase 3: API routes

- [ ] Create `app/api/focus-sessions/route.ts`:
  - `GET`: parse filters via `focusSessionFiltersSchema`, call `focusService.list`.
  - `POST`: parse body via `createFocusSessionSchema`, call `focusService.create`, return 201.

- [ ] Create `app/api/focus-sessions/summary/route.ts`:
  - `GET`: parse `todoId` or `goalId` from searchParams. If `todoId`, return `summaryForTodo`; if `goalId`, return `summaryForGoal`. If neither, return `summaryForWeek`.

## Phase 4: React Query hooks

- [ ] Add to `lib/queries/keys.ts`:
  ```ts
  focus: {
    all: () => ["focus"] as const,
    list: (filters?: object) => ["focus", "list", filters] as const,
    summary: (scope: "todo" | "goal" | "week", id?: string) => ["focus", "summary", scope, id] as const,
  },
  ```

- [ ] Create `lib/hooks/use-focus.ts`:
  - `useFocusSessions(filters?)` — query wrapper
  - `useCreateFocusSession()` — mutation that invalidates `queryKeys.focus.all()`, `queryKeys.todos.detail(todoId)`, `queryKeys.dashboard()`
  - `useTodoFocusSummary(todoId)` — query, enabled when todoId truthy
  - `useWeekFocusSummary()` — query for dashboard stat
  
  Use `apiFetch` from `lib/api-client.ts`.

## Phase 5: Zustand store

- [ ] Create `lib/stores/focus-store.ts`. Use `persist` middleware. Shape:
  ```ts
  interface FocusState {
    mode: "idle" | "focus" | "break";
    todoId: string | null;
    todoTitle: string | null;
    startedAt: string | null; // ISO
    durationSeconds: number; // planned duration
    focusDuration: number; // default 25 * 60
    breakDuration: number; // default 5 * 60
    setFocusDuration: (s: number) => void;
    setBreakDuration: (s: number) => void;
    startFocus: (todoId: string | null, todoTitle: string | null) => void;
    startBreak: () => void;
    stop: () => void;
    reset: () => void;
  }
  ```
  Persist `focusDuration`, `breakDuration`, `mode`, `todoId`, `todoTitle`, `startedAt`, `durationSeconds`. Version 1 with migration hook.

## Phase 6: UI components

- [ ] Create `components/focus/focus-timer-widget.tsx`. A `Popover` anchored from the sidebar footer button. Internal state reads from `useFocusStore`. Computes remaining time each render from `Date.now() - startedAt`. Uses `useEffect` + `setInterval(1000ms)` to force re-render. When remaining <= 0, fires completion (writes session via `useCreateFocusSession`, shows browser notification, transitions to break mode or idle).
  
  Sub-components:
  - Mode selector: 25/5, 50/10, custom (opens a mini form for focus/break minutes)
  - Todo picker: small combobox to pick a todo (optional). Uses `useTodos({ status: "PENDING" })`.
  - Start button
  - Running state: big countdown "14:32", pause (optional v2), stop button
  - Break state: "Break 4:00" + skip button

- [ ] Create `components/focus/focus-timer-button.tsx`. Small button for the sidebar footer showing "Focus" idle or "14:32 ⏹" when running.

- [ ] Wire into `components/layout/app-sidebar.tsx` (in the footer area near the theme toggle). Also mount the widget at a higher level (in `app/(app)/layout.tsx`) so the timer stays alive regardless of which page is showing.

- [ ] Edit `components/todos/todo-detail.tsx`: add a "Focus" button in the action row that calls `focusStore.startFocus(todoId, title)`. Show total focus time badge using `useTodoFocusSummary(todoId)`.

- [ ] Edit `components/dashboard/streaks-stats-widget.tsx`: add a "Focus time" stat card using `useWeekFocusSummary()`. Format seconds as "Xh Ym".

## Phase 7: MCP tool

- [ ] Add tool definition to `lib/mcp/schemas.ts` `TOOL_DEFINITIONS`:
  ```ts
  {
    name: "get_focus_sessions",
    description: "List focus/Pomodoro sessions with optional filters by todo, goal, or date range",
    inputSchema: {
      type: "object",
      properties: {
        todoId: { type: "string" },
        goalId: { type: "string" },
        dateFrom: { type: "string", description: "ISO datetime" },
        dateTo: { type: "string", description: "ISO datetime" },
      },
    },
  }
  ```

- [ ] Create `lib/mcp/tools/focus-tools.ts` with `handleFocusTools(userId, name, args)` using the pattern from `lib/mcp/tools/todo-tools.ts`. Inside the handler, validate args with `focusSessionFiltersSchema` and call `focusService.list`.

- [ ] Register in `lib/mcp/server.ts`: add `FOCUS_TOOLS = new Set(["get_focus_sessions"])` and the routing branch.

## Phase 8: Verification

- [ ] Run `npx tsc --noEmit`. Must pass.
- [ ] Run `npm run build`. Must pass.
- [ ] Manually verify: start a timer with no todo → runs → completes → writes session (check DB via `npx prisma studio`). Start a timer linked to a todo → the todo's detail shows focus time after completion.
- [ ] Run `/ax:review` and `/ax:deploy-check`.
