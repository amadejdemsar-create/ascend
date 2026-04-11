# Ascend — Full Codebase Review

**Date:** 2026-04-10
**Scope:** entire repo — 190 TS/TSX files across `lib/`, `components/`, `app/`, `prisma/`, `lib/mcp/`
**Baseline:** `npx tsc --noEmit` passes with zero errors
**Verdict:** FAIL to ship as-is. Two cross-tenant data-leak bugs, two missing-Zod injection surfaces, a recently-shipped feature that silently corrupts XP/progress on every undo, a real user-visible regression in the latest v2 bug-fix commit, and a load-bearing danger zone (`search_vector`) defended by nothing but human memory.

The architectural bones are correct. Most services follow the rules. The failures are concentrated, not systemic — which means they are also fixable in a focused sprint, not a rewrite.

---

## CRITICAL (fix before next deploy — data leaks or injection)

### C1 — Cross-tenant goal update
**File:** `lib/services/goal-service.ts:69-95`

`goalService.update()` only runs the `findFirst({ id, userId })` guard when `parentId` or `horizon` is in the payload. Every other field (title, description, priority, notes, status ≠ COMPLETED, progress, sortOrder) hits `prisma.goal.update({ where: { id } })` with no userId check. A PATCH to `/api/goals/<other-user-id>` with `{ title: "owned" }` succeeds across tenants.

**Fix:** Move the ownership guard to the top of the method unconditionally.

### C2 — Cross-tenant raw SQL in context delete
**File:** `lib/services/context-service.ts:122-126`

`$executeRaw` runs `UPDATE "ContextEntry" SET "linkedEntryIds" = array_remove(...) WHERE ${id} = ANY(...)` with no userId filter. Violates the multi-tenant boundary even if collisions are unlikely.

**Fix:** Add `AND "userId" = ${userId}` to the WHERE clause.

### C3 — Import REST route bypasses Zod
**File:** `app/api/import/route.ts:8-97`

`await request.json()` goes straight to `isOldTodosFormat` / `migrateOldFormat` / `as CreateGoalInput` casts. No schema from `lib/validations.ts`. Directly violates safety rule 2. Arbitrary strings reach Prisma.

### C4 — Import MCP tool bypasses Zod
**File:** `lib/mcp/tools/data-tools.ts:41-153`

`import_data` handler has the same pattern. MCP rule 3 explicitly requires Zod validation inside handlers.

**Fix for C3+C4:** Add `importDataSchema` (discriminated union for old vs new shape) to `lib/validations.ts`, parse body through it before any service call.

---

## HIGH (correctness, pattern violations with user-visible blast radius)

### H1 — Todo "uncomplete" silently corrupts state (commit `a0dd79b`)
**File:** `components/calendar/calendar-day-detail.tsx` → `useUpdateTodo` → `todoService.update`

The toggle added in the most recent commit routes undo through a plain `todo.update({ status: "PENDING" })`. That method does NOT revoke the `XpEvent`, decrement `UserStats.totalXp`, recompute level, reverse `goalService.logProgress`, or undo the recurring streak increment.

**Net effect:** every toggle cycle (complete → uncomplete → complete) permanently duplicates XP, double-increments goal progress, and double-advances the recurring streak. The fix just shipped is an active corruption vector.

**Fix:** Implement `todoService.uncomplete(userId, id)` as a proper inverse (find-and-delete the XpEvent, decrement stats, reverse progress, decrement streak) wrapped in `$transaction`. Route the toggle through it. Requires a `XpEvent.todoId String?` column so events are reversible by source.

### H2 — Commit `e6ec8cc` regression: cannot clear category/goal on todos
**Files:** `components/todos/todo-detail.tsx` + `lib/validations.ts` `updateTodoSchema`

`updateTodoSchema` declares `categoryId`/`goalId` as `z.string().optional()` — not nullable. The click-to-edit UI in todo-detail sends `undefined` when the user selects `__none__`, which Zod silently strips. Users cannot actually clear a category or goal — the dropdown visibly reverts after save.

**Fix:** Make both fields `z.string().nullable().optional()`, handle `null` in `todoService.update`, send `null` (not `undefined`) from the UI sentinel branch.

### H3 — Todo completion flow is non-transactional (danger zone, worse than documented)
**File:** `lib/services/todo-service.ts:131-213`

Seven sequential writes across 4 tables + 2 cross-service calls (`goalService.logProgress`, `todoRecurringService.completeRecurringInstance`), totaling nine writes with zero transaction wrapping. A crash between steps leaves: XP awarded without stats update, goal `currentValue` unchanged despite the "done" mark, streak advanced but `XpEvent` missing, etc.

`bulkComplete` at line 375 wraps each completion in try/catch and continues on failure — a single bulk call can leave half completed, half untouched, and return `success: true` mixed with `success: false` rows.

**Fix:** Wrap via interactive `prisma.$transaction(async (tx) => ...)`. Propagate `tx` through `goalService.logProgress(tx, ...)` and `todoRecurringService.completeRecurringInstance(tx, ...)` by adding an optional param defaulting to `prisma`.

### H4 — Visit-triggered recurring todo generation (danger zone wide open)
**File:** `app/(app)/calendar/page.tsx:44-52` is the ONLY trigger for `todoRecurringService.generateInstancesForRange`.

Zero cron, zero on-login handler, zero lazy-on-read in `todoService.list`. Contrast with goal recurring, which fires from the dashboard `useEffect`. If the user skips the calendar for a week, that week's recurring todo instances never materialize. The `consistencyScore` plummets because "expected" count grows while "completed" stays zero. MCP clients bypass the calendar entirely, so AI-driven usage never generates anything.

**Minimum fix (15 min):** copy the dashboard's `useEffect` parity trick to post to `/api/todos/recurring/generate` on first dashboard load.
**Proper fix:** lazy generation inside `todoService.list`/`getByDate` OR scheduled cron via Dokploy.

### H5 — N+1 + dedup race in `generateInstancesForRange` (shipped in `e6ec8cc`)
**File:** `lib/services/todo-recurring-service.ts`

For each occurrence of each template, runs `findFirst` then `create` separately. Fires on every calendar month navigation. Plus the existing-instance check uses `dueDate: occDate` (exact `DateTime` equality) — any pre-existing instance with a non-midnight time will be missed, creating duplicates. Plus the `findFirst` is not userId-scoped.

**Fix:** Batch via `findMany` (IN clause on occurrence dates) + `createMany` with `skipDuplicates`. Add `userId` to the WHERE. Compare dates by day, not exact timestamp.

### H6 — Prisma imported outside the service layer (5 locations, rule 4)
Direct Prisma imports found in:
1. `lib/auth.ts:2` — `validateApiKey` calls `prisma.user.findUnique`
2. `lib/tree-queries.ts:1` — entire file is orphaned (see dead code) but also uses `$queryRaw` directly
3. `app/api/goals/onboarding/route.ts:3` — direct `prisma.user.update`
4. `app/api/health/route.ts:2` — direct `prisma.user.count`, `prisma.userStats.count`
5. `lib/mcp/tools/goal-tools.ts:2` — `deleteCascade` helper calls Prisma directly (explicitly forbidden by MCP rule 1)

**Fix:** Push each into a service method.

### H7 — userId missing in WHERE clauses (rule 1, defense-in-depth)
Functionally safe today because parents are user-scoped, but the rule is absolute:

- `lib/services/todo-recurring-service.ts` lines 73-79, 91-94, 98-101, 157-162, 226-232, 247-255
- `lib/services/recurring-service.ts` lines 107-112, 127-130, 186-193
- `lib/services/todo-service.ts:313-321` — `setBig3` runs `updateMany({ where: { id: { in: todoIds } } })` without userId

### H8 — Cross-domain cache invalidation gaps
**File:** `lib/hooks/use-categories.ts`

- `useUpdateCategory` (lines 45-58) doesn't invalidate goals/todos/context queries that include category data. Category renames don't propagate.
- `useDeleteCategory` (lines 60-71) misses todos and context (both reference `categoryId`).

**Fix:** Add `queryKeys.goals.all()`, `queryKeys.todos.all()`, `queryKeys.context.all()` to both.

### H9 — 10 components bypass the hook layer with direct `fetch()`
Component rule violation. Notable ones:
- `components/goals/progress-increment.tsx:25-46` — defines its own local `useLogProgress` that omits `dashboard()` invalidation. Dashboard widgets go stale after progress increments.
- `components/goals/goal-status-select.tsx:90` — direct GET with manual headers
- `components/command-palette/command-palette.tsx:84-86` — 3 manual fetches in `Promise.allSettled`
- Plus: `progress-history-sheet`, `context-entry-detail`, `dashboard-page` (onboarding PATCH), `category-delete-dialog`, `onboarding-wizard`, `onboarding-mcp-guide`, settings export/import.

### H10 — 3 API routes define Zod schemas inline instead of in `lib/validations.ts`
- `app/api/todos/bulk-complete/route.ts:6-8`
- `app/api/todos/big3/route.ts:6-9`
- `app/api/todos/reorder/route.ts:6-16`

### H11 — MCP `move_goal` skips Zod entirely
**File:** `lib/mcp/tools/bulk-tools.ts:64-84` — builds `Record<string, unknown>` payload and passes it straight to `goalService.update`. If `args.horizon` is garbage it reaches Prisma as a cryptic error.

### H12 — 3 MCP handlers missing `isError: true` on error paths
- `category-tools.ts` lines 51-53, 64-67, 91-95
- `data-tools.ts` lines 43-46, 52-55, 175-180
- `dashboard-tools.ts` lines 158-166

Clients will interpret these failures as successful JSON output.

---

## MEDIUM (hygiene, danger zones, drift)

### M1 — `search_vector` column has ZERO automated safeguard (danger zone 2)
`prisma/schema.prisma` has no comment near `ContextEntry` warning about the tsvector column. No CI check for `DROP COLUMN "search_vector"` in generated migrations. No husky hook. No startup assertion. Only CLAUDE.md rule 6, the reviewer agent, and the deploy-check skill (all human-invoked) defend against accidental drop.

**Highest-leverage, lowest-effort fix in the entire audit:** add a big comment block above `model ContextEntry` in the schema. One file, 8 lines.

Followup: add a `.github/workflows/db-safety.yml` that greps generated migrations for `DROP COLUMN "search_vector"` and fails the PR.

### M2 — `fetchJson` duplicated in 16+ files (not 5 as CLAUDE.md claims)
Five hooks plus ~11 component call sites. One copy (`use-context.ts`) has already drifted — it handles 204 No Content; the others will throw on empty bodies the moment any other route returns 204.

**Fix:** Extract to `lib/api-client.ts`, adopt the 204-handling variant as canonical, mechanically replace all sites.

### M3 — Two recurring services with ~35% duplicated logic
`recurring-service.ts` (goals, enum-based) vs `todo-recurring-service.ts` (todos, rrule-based). Date math differs (legitimate), but streak bump, longest-streak high-water mark, "has pending instance" check, and the template/instance pattern are all duplicated.

**Recommendation:** Don't merge (rrule vs enum difference is real), but extract `lib/services/recurring-helpers.ts` for shared bits and rename `recurringService` → `goalRecurringService` for symmetry.

### M4 — XP/stats logic reimplemented in `todoService.complete`
Instead of calling `gamificationService.awardXp`, `todoService.complete` reinlines the whole upsert+update+weeklyReset+level math at lines 149-192. Two sources of truth for the same thing.

### M5 — `logProgress` is its own mini-non-transactional race
**File:** `lib/services/goal-service.ts:159-187` — creates progress log, then updates goal, two separate calls, no transaction.

### M6 — GET query params not Zod-validated
- `app/api/todos/by-date/route.ts:11-18`, `by-range/route.ts:11-19`
- `app/api/goals/by-deadline-range/route.ts:11-19`
- `app/api/todos/recurring/generate/route.ts` — `start`/`end` go straight to `new Date()`

### M7 — `any` casts and defensive dead code
- `lib/mcp/tools/dashboard-tools.ts:12` — `formatTree(goals: any[], ...)`
- `lib/mcp/server.ts:148-163` — `svc as any` with try/catch fallback for `getCurrentPriorities` which has been implemented for months
- `export-service.ts` — 4 inline `as unknown as Array<Record<string, unknown>>` casts

### M8 — `services/todo-service.ts:19` and `services/context-service.ts:10` use `Record<string, unknown>` for `where`
Direct service-patterns rule 3 violation. Should be `Prisma.*WhereInput`.

### M9 — Goal filter dropdown only walks 2 hierarchy levels
Shipped in `e6ec8cc`. Users with year > month > week structures lose grandchildren from the filter.

### M10 — `NEXT_PUBLIC_API_KEY` exposed client-side in 17 files
Any site visitor can read the API key in devtools. Documented design choice for single-user, but needs a loud comment and a plan for multi-user.

---

## LOW

- **L1** — No test files exist anywhere.
- **L2** — (fixed in this review) `CLAUDE.md` said cache timing lives at `lib/queries/cache-config.ts` but the actual path is `lib/offline/cache-config.ts`.
- **L3** — `CLAUDE.md:147` says fetchJson is duplicated in 5 files; reality is 16+.
- **L4** — `.claude/settings.json` hook hardcodes `/Users/Shared/Domain/Code/Personal/ascend` absolute path.
- **L5** — `components/command-palette/keyboard-shortcuts.tsx:23-27` help dialog still lists Cards view and Board view.
- **L6** — `lib/mcp/schemas.ts:425` `update_settings.defaultView` enum still advertises `"board"`.
- **L7** — `app/_landing/ViewsSection.tsx` markets Cards + Board + 3 others as live.
- **L8** — `components/goals/dnd-goal-provider.tsx:47-74` has an unreachable `columnKey` branch.
- **L9** — `isOverdue()` duplicated byte-identical across 3 todo files.
- **L10** — `HORIZON_ORDER` defined twice.
- **L11** — Enum constants triplicated across `constants.ts` / `validations.ts` / `schemas.ts` / Prisma.
- **L12** — `lib/offline/outbox.ts` exports `enqueue()` which is never called.

---

## Dead code / quick-win deletions

| Target | Lines | Risk | Rationale |
|---|---|---|---|
| `lib/tree-queries.ts` | 58 | none | Zero import sites, replaced by `goalService.getTree` |
| `components/goals/goal-board-{card,column,view}.tsx` | ~400 | none | Already marked DEAD in `.claude/COMPONENT_CATALOG.md` |
| `lib/services/dashboard-service.ts:243 getChildrenProgress()` | 13 | none | Zero call sites |
| `lib/services/gamification-service.ts:102 getStats()` | 25 | low | Zero call sites |
| `UserStats.lastActiveDate` column | — | low | Never read, never written |
| `UserStats.goalsCompleted` column | — | low | Write-only, dead consumer |
| `lib/constants.ts DEFAULT_CATEGORIES` | 7 | none | No import sites |

---

## What's good (calibration)

1. `goalService.create/delete/logProgress/reorderGoals` follow the correct findFirst-then-mutate pattern.
2. `todoService.update/delete/complete/skip/reorder` are textbook.
3. `categoryService` is flawless — every method scoped, tree built from a single user-scoped query.
4. `dashboardService` is the reference for safe aggregation.
5. `gamificationService.awardXp` (goal path) is correctly scoped.
6. 32 of 36 API routes follow the auth → parse → service → respond pattern uniformly.
7. MCP Set-based dispatch is clean and scales.
8. React Query key factory is well-organized and consistently used.
9. `useCompleteTodo`/`useBulkCompleteTodos` do cross-domain invalidation correctly — canonical pattern.
10. Prisma schema correctly omits `search_vector` (so it is not dropped).
11. `context-service.getById` correctly fetches backlinks with userId + `linkedEntryIds.has(id)`.
12. 37 MCP tools fully wired — schemas, Sets, and handlers all agree.
13. Recent commit `70e03e8` (rrule DTSTART fix) is a clean root-cause fix.
14. TypeScript passes with zero errors.

---

## Recommended fix order

1. C1 — goalService.update unconditional guard
2. C2 — context-service.delete userId filter
3. M1 — search_vector warning comment
4. H2 — updateTodoSchema accept null
5. H4 min — dashboard parity for todo recurring
6. C3 + C4 — importDataSchema + REST + MCP
7. H1 — todoService.uncomplete + XpEvent.todoId migration
8. H3 — wrap todoService.complete in $transaction
9. H5 — batch N+1 + userId scope
10. H6 — direct Prisma imports into service methods
11. H7 — userId in recurring services WHERE clauses
12. H8 + H9 — cache invalidation + component fetch cleanup
13. M2 — extract lib/api-client.ts
14. Dead code sweep
15. M1 followup — CI workflow

**Estimated total: a focused day of work (8-12 hours) closes every blocker and every known danger zone except the two recurring systems (M3), which is architectural cleanup worth doing separately.**
