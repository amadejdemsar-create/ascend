# Focus Timer (Pomodoro)

**Slug**: focus-timer
**Created**: 14. 4. 2026
**Status**: planning

## Problem

Ascend captures what to do (todos, goals) and reflects on what was done (weekly review) but offers nothing for the actual act of doing. Users plan in Ascend and then switch to a separate tool (Forest, Focus Keeper, or a kitchen timer) to execute. Bringing a Pomodoro-style focus timer into Ascend closes the loop between planning and execution, and creates a clean data source for "how much deep work did I actually do this week."

## User Story

As a user, I want to start a focused work session tied to a specific todo so that I can execute with structure and track my cumulative deep-work time per todo and per goal.

## Success Criteria

- [ ] A floating focus timer widget accessible from the sidebar footer and from any todo detail panel
- [ ] Default Pomodoro cycle: 25 minutes focus + 5 minutes break. Configurable to 50/10 and custom values.
- [ ] User can link a todo to the session before starting; the todo's title shows in the timer
- [ ] Timer persists across page navigation (Zustand + localStorage for tick persistence; backed by a DB record on session completion)
- [ ] When a focus session completes, a `FocusSession` row is written with `todoId`, `goalId` (inherited from todo if linked), `durationSeconds`, `startedAt`, `endedAt`
- [ ] Browser Notification API used to alert the user when the session ends (only if granted)
- [ ] Todo detail panel shows "Total focus time: N hours M minutes" if any sessions exist
- [ ] Dashboard shows a small "Focus time this week" stat in the Level & Stats widget
- [ ] `MCP tool get_focus_sessions(todoId?, dateFrom?, dateTo?)` for querying from Claude

## Affected Layers

- **Prisma schema**: new `FocusSession` model with migration
- **Service layer**: new `lib/services/focus-service.ts`
- **API routes**: `POST /api/focus-sessions` (create completed session), `GET /api/focus-sessions` (list with filters), `GET /api/focus-sessions/summary` (aggregates per todo/goal)
- **React Query hooks**: new `lib/hooks/use-focus.ts` with `useFocusSessions()`, `useCreateFocusSession()`, `useTodoFocusSummary(todoId)`
- **UI components**: new `components/focus/focus-timer-widget.tsx` (the floating timer), new `components/focus/focus-timer-controls.tsx` (start/pause/reset/mode toggle), modified `components/todos/todo-detail.tsx` (add "Focus" button + total time), modified `components/dashboard/streaks-stats-widget.tsx` (add focus time stat)
- **MCP tools**: new `get_focus_sessions` tool
- **Zustand store**: new `lib/stores/focus-store.ts` (session state, persist with middleware)

## Data Model Changes

```prisma
model FocusSession {
  id              String   @id @default(cuid())
  userId          String
  todoId          String?
  goalId          String?
  durationSeconds Int
  mode            String   // "focus" or "break"
  startedAt       DateTime
  endedAt         DateTime
  createdAt       DateTime @default(now())

  user User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  todo Todo? @relation(fields: [todoId], references: [id], onDelete: SetNull)
  goal Goal? @relation(fields: [goalId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([todoId])
  @@index([goalId])
  @@index([startedAt])
}
```

Also add `focusSessions FocusSession[]` relation on `User`, `Todo`, and `Goal`.

Migration name: `add_focus_sessions`.

## API Contract

### POST /api/focus-sessions

Request:
```json
{
  "todoId": "abc123",
  "durationSeconds": 1500,
  "mode": "focus",
  "startedAt": "2026-04-14T10:00:00.000Z",
  "endedAt": "2026-04-14T10:25:00.000Z"
}
```
Response: 201 with the created session (includes derived `goalId` from the todo).

### GET /api/focus-sessions?todoId=X&dateFrom=...&dateTo=...

Response: array of focus sessions matching filters, newest first.

### GET /api/focus-sessions/summary?todoId=X

Response:
```json
{ "totalSeconds": 7500, "sessionCount": 5 }
```

Similar summary endpoints can accept `goalId` or `dateFrom`/`dateTo`.

## UI Flows

**Floating timer widget** (sidebar footer, desktop only):
1. Button labeled "Focus" opens a small popover with the timer controls
2. Default state: "Select a todo" field + "Start focus" button (25:00)
3. Click "Start" → timer counts down; widget becomes compact (time + stop button) in the sidebar footer
4. Timer persists across navigation (Zustand + tick via `requestAnimationFrame` or `setInterval`)
5. On completion: browser notification, toast, write session to DB, switch to break mode
6. Break mode: 5:00 countdown, skip button
7. After break: idle state again

**Todo detail**:
- "Focus" button next to the Complete button. Click → opens the focus timer widget pre-filled with this todo.
- Total focus time badge: "⏱ 2h 30m" if sessions exist.

**Dashboard stats**:
- One new stat in the Level & Stats widget: "Focus time this week: 12h 30m"

## Cache Invalidation

- `useCreateFocusSession` onSuccess: invalidate `queryKeys.focus.all()`, `queryKeys.todos.detail(todoId)` (to refresh focus summary badge), `queryKeys.dashboard()` (for week stat).

## Danger Zones Touched

**No transaction wrapping in todo completion** (from CLAUDE.md). Not touched. Focus session creation is independent of todo completion.

**Timer tick accuracy.** `setInterval` drifts under heavy load. Use a `Date.now()`-based approach: store `startedAt` and compute remaining time each tick, not decrement a counter.

**Browser tab backgrounding.** When the tab is backgrounded, `setInterval` throttles. The `Date.now()` approach handles this correctly (time math is always against the wall clock).

**Persistence across refresh.** Zustand `persist` middleware writes to localStorage. On page load, if there's an active session in storage, resume from the stored `startedAt`. If the computed time is already past `endedAt`, write the session immediately (missed completion while tab was closed).

## Out of Scope

- Sound effects / custom alarm tones (use default browser notification)
- Music / ambient sounds (separate feature)
- Sharing focus sessions with a team
- Forest-style gamification (tree grows / dies)
- Editing or deleting sessions after the fact
- Forcing the timer to complete automatically if user is idle

## Open Questions

None. The Pomodoro model is standard; persistence rules are explicit above.
