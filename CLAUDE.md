# Ascend

Personal operating system built on the inputs/outputs framework. Goals are outputs (results you want), todos are inputs (actions that drive results), context is your AI knowledge base, and the calendar ties it all into daily planning. The entire system is exposed via 37 MCP tools.

## Tech Stack

Next.js 16 (App Router), Prisma 7, PostgreSQL, Zod 4, React 19, TanStack Query v5, Zustand 5, MCP SDK, rrule, date-fns, shadcn/ui, Tailwind CSS 4, lucide-react, canvas-confetti, marked

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (catches TS errors, run before pushing)
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create and apply a migration
npx prisma studio    # Visual database browser
```

## Safety Rules

1. **NEVER modify data without userId check.** Every Prisma query in services MUST include `userId` in the `where` clause. The schema is multi-tenant; skipping this leaks data across users.
2. **NEVER skip Zod validation in API routes.** Every POST/PUT/PATCH body MUST be parsed through a schema from `lib/validations.ts` before reaching the service layer.
3. **ALWAYS invalidate React Query cache after mutations.** Use `queryClient.invalidateQueries({ queryKey: queryKeys.<domain>.all() })`. Cross-domain invalidation is required when one mutation affects another domain (todo completion must invalidate `queryKeys.goals.all()` and `queryKeys.dashboard()`).
4. **ALWAYS use the service layer.** Never import `prisma` directly in API routes or components. All database access goes through `lib/services/`.
5. **ALWAYS run `npm run build` before pushing.** The build catches TypeScript errors that `npm run dev` does not surface.
6. **NEVER run `prisma db push` or `prisma migrate reset`.** The `search_vector` tsvector column on ContextEntry was added via raw SQL migration and is invisible to Prisma. Schema-first operations will drop it and break full-text search.

## Execution Quality Bar (Ascend)

**The global `Execution Quality Bar (Mandatory)` rule in `~/.claude/CLAUDE.md` applies in full to every Ascend task. This section extends it with Ascend-specific quality checks. Both apply simultaneously.**

The standard is SpaceX engineering: if it is worth doing, it is worth doing right. No shortcuts, no half measures, no silent simplification. Amadej would rather you deliver 40% of a feature fully and transparently than 100% half-baked with gaps hidden.

### Before Starting Any Feature or Bug Fix

1. **Use `ax:plan` for anything that touches more than one file.** It produces a mandatory deliverables checklist (`.ascendflow/features/<slug>/TASKS.md`) and a PRD. No feature work starts without the checklist presented to the user and approved.
2. **Search the codebase for similar implementations first.** Before writing a new service method, hook, route, or component, Grep/Glob for the closest analog and read it end to end. The canonical references are:
   - Service method: read the closest method in `lib/services/<domain>-service.ts`
   - React Query hook: read `lib/hooks/use-goals.ts` for the `useMutation` + cache invalidation shape
   - API route: read any existing `app/api/**/route.ts` for the auth-parse-service-respond skeleton
   - Component: read `components/goals/goal-detail.tsx` (detail panel), `components/goals/goal-filter-bar.tsx` (filter), `components/goals/quick-add.tsx` (inline creation)
   - MCP tool: read `lib/mcp/schemas.ts` + `lib/mcp/tools/<domain>-tools.ts` + `lib/mcp/server.ts`
3. **Check `COMPONENT_CATALOG.md`** at `.claude/COMPONENT_CATALOG.md` before creating any new component. Duplicating existing components is the most common UI mistake.

### Ascend-Specific Quality Checks (mandatory before declaring done)

Every feature or fix must pass ALL of these before you may say "done":

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` passes with zero errors (this is safety rule 5; dev mode misses App Router route-level errors)
- [ ] Every Prisma query in touched services includes `userId` in the `where` clause
- [ ] Every touched POST/PUT/PATCH route parses the body through a Zod schema from `lib/validations.ts`
- [ ] Every touched mutation invalidates the correct query keys, including cross-domain invalidations
- [ ] No new direct imports of `@/lib/db` or `@prisma/client` outside `lib/services/`
- [ ] No console errors in the browser on the affected page (verify in Dia via Chrome DevTools MCP for UI work)
- [ ] All relevant patterns from `.claude/rules/` followed (service-patterns, api-route-patterns, component-patterns, mcp-tool-patterns)

### Forbidden Phrases When Any Check Fails

If the build fails, types fail, a safety rule is violated, or any item above is NOT DONE, you may NOT say:
- "Complete" / "All done" / "Finished" / "Ready to ship" / "Ready to deploy" / "Ready to commit"
- "Tests pass" (when TypeScript errors or build errors exist)
- "Approved" (from a reviewer when any FAIL exists)

You MUST say instead:
- "Partially complete. The build fails at X. Remaining: fix the type error in <file>:<line>, re-run `ax:test`."
- "Not ready to deploy. `ax:deploy-check` failed at step N because [reason]."

### Completion Checklist (mandatory)

Before declaring any feature or fix complete, re-list every task from the `TASKS.md` produced by `ax:plan` and mark each as: DONE / SKIPPED (with reason) / NOT DONE (with reason). If ANY are SKIPPED or NOT DONE, use "partially complete" and explain exactly what remains. This is the same pattern enforced by the global Execution Quality Bar and by `ax:deploy-check`.

## Architecture

### Service Layer (`lib/services/`)
All business logic. Const objects with async methods. `userId` is always the first parameter. Services call Prisma directly. 12 service modules: goal, todo, context, category, dashboard, gamification, export, import, recurring, todo-recurring, hierarchy-helpers, export-helpers.

### API Routes (`app/api/`)
Thin wrappers: authenticate via `validateApiKey()`, parse input with Zod, call service, return `NextResponse.json()`. Error handling via `handleApiError()` from `lib/auth.ts`.

### React Query Hooks (`lib/hooks/`)
One hook file per domain. `useQuery` for reads, `useMutation` for writes with `onSuccess` cache invalidation. Query key factory in `lib/queries/keys.ts`. Cache config in `lib/offline/cache-config.ts`.

### MCP Server (`lib/mcp/`)
37 tools across 8 handler files. Schemas in `lib/mcp/schemas.ts` as raw JSON Schema (not Zod) for SDK compatibility. Handlers in `lib/mcp/tools/` call the service layer. Routing in `lib/mcp/server.ts` uses Set-based name matching to dispatch to handlers. Transport: Streamable HTTP at `/api/mcp`.

### State Management
Server state: React Query (all data fetching and caching).
UI state: Zustand store at `lib/stores/ui-store.ts` (sidebar, active view, filters, sorting, timeline zoom, modal state). Persisted to localStorage with version migration.

### Two-Panel Layout
`app/(app)/layout.tsx` wraps all authenticated pages with sidebar + main content. `components/layout/app-sidebar.tsx` renders nav links and category tree. Mobile: bottom tab bar + drawer.

## Entity Model

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| User | Single-user, API key auth | Has goals, todos, context, categories, stats |
| Goal | Hierarchical objectives (yearly > quarterly > monthly > weekly) | Self-ref parentId, has children, todos, progressLogs, category |
| Todo | Flat tasks, Big 3, streaks, recurrence | Links to one goal (goalId), category, self-ref recurringSourceId |
| ContextEntry | Markdown docs, tags, wikilinks, full-text search | Category, linkedEntryIds array |
| Category | Shared taxonomy, hierarchical (self-ref parentId) | Used by goals, todos, context |
| ProgressLog | Time-series progress per goal | Belongs to goal |
| UserStats | Aggregated XP, level, streaks | Belongs to user |
| XpEvent | Individual XP awards | Belongs to user |

## Views

| View | Entity | Component |
|------|--------|-----------|
| List | Goals, Todos | `goal-list-view.tsx`, `todo-list-view.tsx` |
| Tree | Goals | `goal-tree-view.tsx` |
| Timeline (Gantt) | Goals | `goal-timeline-view.tsx` |
| Calendar | Todos, Goals | `calendar-month-grid.tsx`, `calendar-day-detail.tsx` |
| Dashboard | All | `dashboard-page.tsx` (5 widgets) |

Board/Kanban view components exist (`goal-board-*.tsx`) but are dead code; removed from the view switcher.

## Key File Lookup

| Need to... | File |
|------------|------|
| Change auth | `lib/auth.ts` |
| Add/modify Prisma model | `prisma/schema.prisma` |
| Add validation schema | `lib/validations.ts` |
| Add React Query key | `lib/queries/keys.ts` |
| Change cache timing | `lib/offline/cache-config.ts` |
| Modify UI state | `lib/stores/ui-store.ts` |
| Add nav item | `components/layout/nav-config.ts` |
| Add MCP tool schema | `lib/mcp/schemas.ts` |
| Route MCP tool | `lib/mcp/server.ts` |
| Change XP/level constants | `lib/constants.ts` |
| Filter goal trees | `lib/tree-filter.ts` |
| Timeline date math | `lib/timeline-utils.ts` |

## Danger Zones

**No transaction wrapping in todo completion.** `lib/services/todo-service.ts` and `lib/services/gamification-service.ts` perform status update, goal progress recalc, XP event creation, and stats update as separate Prisma calls. A mid-flow failure leaves data inconsistent.

**Context search_vector not in Prisma schema.** Added via raw SQL migration. Prisma does not know about it. See safety rule 6.

**Two separate recurring systems.** `lib/services/recurring-service.ts` (goals) and `lib/services/todo-recurring-service.ts` (todos) handle recurrence independently. Naming is confusing and there may be shared logic.

**Recurring instance generation is visit-triggered.** `todo-recurring-service.ts` only generates instances when the calendar page loads. If the user does not visit the calendar, recurring todos will not appear.

**fetchJson duplicated.** The `fetchJson` helper with API key headers is copy-pasted in `use-goals.ts`, `use-todos.ts`, `use-context.ts`, `use-categories.ts`, and `use-dashboard.ts`. Extract to a shared module when modifying any of these.

## Deployment

Deployed via Dokploy (dokploy-personal) to `ascend.nativeai.agency`. Auto-deploys on push to main via GitHub provider. Docker build from the root `Dockerfile`.

@import rules/service-patterns.md
@import rules/api-route-patterns.md
@import rules/component-patterns.md
@import rules/mcp-tool-patterns.md
