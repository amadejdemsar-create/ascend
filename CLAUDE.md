# Ascend

Personal operating system built on the inputs/outputs framework. Goals are outputs (results you want), todos are inputs (actions that drive results), context is your AI knowledge base as a typed-edge graph, and the calendar ties it all into daily planning. The entire system is exposed via 47 MCP tools.

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

1. **NEVER modify data without userId check.** Every Prisma query in services MUST include `userId` in the `where` clause (or be scoped by an unguessable internal secret like `refreshTokenHash` / `familyId` UUID, with justification in a code comment). The schema is multi-tenant; skipping this leaks data across users.
2. **NEVER skip Zod validation in API routes.** Every POST/PUT/PATCH body MUST be parsed through a schema from `apps/web/lib/validations.ts` (which re-exports from `@ascend/core`) before reaching the service layer.
3. **ALWAYS invalidate React Query cache after mutations.** Use `queryClient.invalidateQueries({ queryKey: queryKeys.<domain>.all() })`. Cross-domain invalidation is required when one mutation affects another domain (todo completion must invalidate `queryKeys.goals.all()` and `queryKeys.dashboard()`).
4. **ALWAYS use the service layer.** Never import `@/lib/db` or `@prisma/client` directly in API routes, middleware, components, hooks, or scripts. All database access goes through `apps/web/lib/services/`.
5. **ALWAYS run `pnpm --filter @ascend/web build` before pushing.** The build catches TypeScript errors that `pnpm dev` does not surface.
6. **NEVER run `prisma db push` or `prisma migrate reset`.** The `search_vector` tsvector column on ContextEntry was added via raw SQL migration and is invisible to Prisma. Schema-first operations will drop it and break full-text search. Wave 0 Phase 6 hand-wrote a migration and applied via `prisma migrate deploy` because `prisma migrate dev --create-only` attempted to DROP `search_vector`. When adding any future migration, either hand-write it or verify the generated SQL does not reference `search_vector` before applying.

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
4. **For UI-adjacent changes, plan to run `ax:verify-ui` before declaring done.** Any diff that touches `components/**`, `app/(app)/**`, `lib/hooks/**`, `lib/stores/**`, `lib/validations.ts`, `lib/api-client.ts`, or `lib/queries/keys.ts` must be verified end-to-end in a real browser via the `ascend-ui-verifier` agent (driven by Playwright). Type-checks and unit tests are not sufficient for the UI path.

### Ascend-Specific Quality Checks (mandatory before declaring done)

Every feature or fix must pass ALL of these before you may say "done":

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` passes with zero errors (this is safety rule 5; dev mode misses App Router route-level errors)
- [ ] Every Prisma query in touched services includes `userId` in the `where` clause
- [ ] Every touched POST/PUT/PATCH route parses the body through a Zod schema from `lib/validations.ts`
- [ ] Every touched mutation invalidates the correct query keys, including cross-domain invalidations
- [ ] No new direct imports of `@/lib/db` or `@prisma/client` outside `lib/services/`
- [ ] For UI-adjacent changes (`components/**`, `app/(app)/**`, `lib/hooks/**`, `lib/stores/**`, `lib/validations.ts`, `lib/api-client.ts`, `lib/queries/keys.ts`), `ax:verify-ui` returns PASS or PASS WITH NOTES with zero blocking scenarios. The verifier clicks through the app via Playwright, writes a report to `.ascendflow/verification/`, and surfaces runtime regressions, console errors, stale cache, and broken navigation that type-checks cannot catch. `ascend-ux` (visual design audits via chrome-devtools in Dia) and `ax:verify-ui` (behavioral verification via Playwright) are complementary: run `ax:verify-ui` for any behavioral change, `ascend-ux` for any visual polish.
- [ ] All relevant patterns from `.claude/rules/` followed (service-patterns, api-route-patterns, component-patterns, mcp-tool-patterns, accessibility)
- [ ] For any Prisma migration, run `ax:migrate` and delegate the SQL review to `ascend-migration-auditor`
- [ ] For any change to `packages/*`, run `ax:cross-platform-check` and delegate the audit to `ascend-architect`
- [ ] For any change to auth, file handling, or multi-tenant boundaries, delegate to `ascend-security`
- [ ] Before declaring a wave done, run `ax:critique` and require `ascend-critic` verdict at GOOD or WORLD-CLASS. NEEDS WORK or NOT READY blocks close.

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

## Mandatory Development Workflow

**CRITICAL: Claude is the orchestrator, not the implementor.** Never implement code changes directly. Claude reads the request, picks the right agents and skills, delegates the work, and synthesizes results. Direct code edits are only acceptable for trivial changes (constants, typos, config). Anything touching business logic, services, components, hooks, routes, or MCP tools MUST go through the appropriate agent.

### Agent Reference

| Agent | When to use | Tools |
|-------|-------------|-------|
| `ascend-dev` | Any code implementation: services, API routes, hooks, components, MCP tools, Prisma schema | Read, Write, Edit, Glob, Grep, Bash, WebFetch |
| `ascend-ux` | Visual design audits, layout reviews, design system checks, CSS/layout fixes (uses chrome-devtools in Dia) | Read, Glob, Grep, Write, Edit, Bash |
| `ascend-reviewer` | Code review against safety rules, pattern compliance, danger zone checks (DZ-1 through DZ-7) | Read, Glob, Grep, Bash |
| `ascend-ui-verifier` | End-to-end browser verification via Playwright after any UI change | Read, Bash, Grep, Glob, Write, Playwright MCP |
| `ascend-architect` | Cross-platform monorepo audits, `packages/*` boundaries, workspace config, platform-agnostic enforcement | Read, Glob, Grep, Bash |
| `ascend-migration-auditor` | Prisma migration safety: SQL review, search_vector verification, backfill plans, rollback paths | Read, Glob, Grep, Bash |
| `ascend-security` | Auth, multi-tenancy, userId scoping, secrets, file uploads, token handling audits | Read, Glob, Grep, Bash |
| `ascend-critic` | Product quality critique at wave close: UX friction, competitive parity, interaction coherence | Read, Glob, Grep |

### Required Workflow Steps

1. **Understand:** Read relevant files, check `.claude/COMPONENT_CATALOG.md`, search for similar implementations
2. **Plan:** Use `/ax:plan` for features touching 3+ files
3. **Implement:** Delegate to `ascend-dev` (or appropriate agent). For cross-surface features, launch multiple agents in parallel.
4. **Verify:** `/ax:test` after backend changes, `/ax:verify-ui` after frontend changes, `/ax:review` after any changes
5. **Report:** Summarize what changed, verification results, whether ready to commit

### Skill Reference

| Command | Purpose | When to use |
|---------|---------|-------------|
| `/ax:plan` | Feature planning pipeline | Before any multi-file feature (produces PRD + TASKS.md) |
| `/ax:test` | Type check + production build | After every code change, before declaring done |
| `/ax:review` | Safety rule + pattern compliance review | After implementation, before committing |
| `/ax:verify-ui` | Browser verification via Playwright | After any UI-adjacent change |
| `/ax:deploy-check` | Pre-deploy validation | Before pushing to main |
| `/ax:save` | Save session state | When context is running low or pausing work |
| `/ax:migrate` | Safe Prisma migration orchestrator | Any time `prisma/schema.prisma` is modified (replaces direct `prisma migrate dev`) |
| `/ax:package` | Scaffold a new monorepo package | When adding a new shared package under `packages/*` |
| `/ax:cross-platform-check` | Grep audit for banned imports in `packages/*` | After extracting code into or modifying a shared package |
| `/ax:wave-start` | Pre-flight check before starting a wave | At the beginning of every Context v2 wave |
| `/ax:wave-close` | Strict completion ritual for closing a wave | At the end of every wave, before starting the next |
| `/ax:critique` | Launch `ascend-critic` for product quality verdict | After `ax:verify-ui` passes, at wave close, before demos |

## Architecture

**Current scope:** pnpm monorepo shipped in Wave 0. The web app lives at `apps/web/`; shared packages live under `packages/*`. Future waves add `apps/mobile` (Expo) in Wave 6 and `apps/desktop` (Tauri) in Wave 9+. The 10-wave Context v2 roadmap is at `.ascendflow/features/context-v2/VISION.md`.

### Shared packages (`packages/*`)

- **`@ascend/core`**: Zod schemas, enums, constants. Pure TypeScript + Zod, platform-agnostic. Re-exported to `apps/web/lib/validations.ts` for web consumption.
- **`@ascend/api-client`**: platform-agnostic HTTP client with `createApiClient({ baseUrl, getAuthHeaders, fetch? })` factory. Uses `globalThis.fetch`. Throws `ApiError` on non-2xx. The web wrapper at `apps/web/lib/api-client.ts` adds cookie-based auth + offline guard + 401 refresh-and-retry interceptor.
- **`@ascend/storage`**: `StorageAdapter` interface + `webStorageAdapter` (localStorage-backed, SSR-safe). Used by Zustand stores so native and desktop apps can swap implementations.
- **`@ascend/ui-tokens`**: raw colors, spacing, typography, and radii tokens. No Tailwind dependency. `apps/web/tailwind.config.ts` imports from here.

### Service Layer (`apps/web/lib/services/`)
All business logic. Const objects with async methods. `userId` is always the first parameter. Services call Prisma directly. Modules: goal, todo, context, category, dashboard, gamification, export, import, recurring, todo-recurring, hierarchy-helpers, export-helpers, **auth (Phase 6)**, **file (Phase 7)**, user.

### API Routes (`apps/web/app/api/`)
Thin wrappers: authenticate via `authenticate()` (3-path resolver: cookie JWT, Bearer JWT, Bearer API key; `validateApiKey` is a backward-compat alias), parse input with Zod, call service, return `NextResponse.json()`. Error handling via `handleApiError()` from `apps/web/lib/auth.ts`.

### React Query Hooks (`apps/web/lib/hooks/`)
One hook file per domain. `useQuery` for reads, `useMutation` for writes with `onSuccess` cache invalidation. Query key factory in `apps/web/lib/queries/keys.ts`. Cache config in `apps/web/lib/offline/cache-config.ts`. All fetches go through `apiFetch` from `apps/web/lib/api-client.ts`.

### MCP Server (`apps/web/lib/mcp/`)
47 tools across handler files (40 CRUD/dashboard + 7 Wave 1 graph tools: `get_context_graph`, `get_node_neighbors`, `get_related_context`, `list_nodes_by_type`, `create_typed_link`, `remove_typed_link`, `update_context_type`). Schemas in `apps/web/lib/mcp/schemas.ts` as raw JSON Schema (not Zod) for SDK compatibility. Handlers in `apps/web/lib/mcp/tools/` call the service layer. Routing in `apps/web/lib/mcp/server.ts` uses Set-based name matching to dispatch to handlers. Transport: Streamable HTTP at `/api/mcp`. Authenticated via API key through `authenticate()` — the API key path of the three.

### Auth (Phase 6 shipped in Wave 0)
- `apps/web/lib/services/auth-service.ts` owns scrypt password hashing, JWT signing/verification via `jose`, 256-bit opaque refresh tokens, `Session` rotation with reuse detection, in-process login rate limiter, cookie builders.
- `apps/web/app/api/auth/login`, `/refresh`, `/logout`, `/me` are the HTTP surface.
- `apps/web/middleware.ts` gates HTML page requests with edge `jose.jwtVerify`, redirects to `/login?redirect=<path>` on missing or invalid cookie.
- `apps/web/app/(auth)/login/page.tsx` is the minimal login form.
- Seed script `apps/web/scripts/set-password.ts` sets the password for a user by email (CLI only, no HTTP route).

### File storage (Phase 7 shipped in Wave 0)
- `apps/web/lib/services/file-service.ts` + `apps/web/app/api/files/presign` and `/confirm` provide presigned-URL uploads to R2. Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. 100 MiB size cap, MIME allowlist, 15-min URL expiry. No UI consumer yet (scaffolding only).

### State Management
Server state: React Query (all data fetching and caching).
UI state: Zustand store at `apps/web/lib/stores/ui-store.ts` (sidebar, active view, filters, sorting, timeline zoom, modal state). Persisted via `@ascend/storage` adapter (never direct localStorage in Wave 0+).

### Two-Panel Layout
`apps/web/app/(app)/layout.tsx` wraps all authenticated pages with sidebar + main content. `apps/web/components/layout/app-sidebar.tsx` renders nav links, category tree, and the logout button. Mobile: bottom tab bar + drawer. `SessionExpiredListener` mounted inside the layout clears React Query cache when the 401 interceptor fires `ascend:session-expired`.

## Entity Model

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| User | Single-user, API key auth | Has goals, todos, context, categories, stats |
| Goal | Hierarchical objectives (yearly > quarterly > monthly > weekly) | Self-ref parentId, has children, todos, progressLogs, category |
| Todo | Flat tasks, Big 3, streaks, recurrence | Links to one goal (goalId), category, self-ref recurringSourceId |
| ContextEntry | Markdown docs, tags, typed wikilinks, full-text search. Typed via `ContextEntryType` (NOTE default, SOURCE, PROJECT, PERSON, DECISION, QUESTION, AREA). | Category, outgoingLinks / incomingLinks (ContextLink) |
| ContextLink | Typed directed edge between two ContextEntries (9 `ContextLinkType` values). Source: CONTENT (parsed from wikilinks) or MANUAL (added via Quick Link dialog). | fromEntry, toEntry, denormalized userId |
| Category | Shared taxonomy, hierarchical (self-ref parentId) | Used by goals, todos, context |
| ProgressLog | Time-series progress per goal | Belongs to goal |
| UserStats | Aggregated XP, level, streaks | Belongs to user |
| XpEvent | Individual XP awards | Belongs to user |

## Views

| View | Entity | Component |
|------|--------|-----------|
| List | Goals, Todos, Context | `goal-list-view.tsx`, `todo-list-view.tsx`, `context-entry-list.tsx` |
| Tree | Goals | `goal-tree-view.tsx` |
| Timeline (Gantt) | Goals | `goal-timeline-view.tsx` |
| Graph | Context (Wave 1) | `context-graph-view.tsx` + `context-graph-node.tsx` (ReactFlow + d3-force via `@ascend/graph`) |
| Pinned | Context | Filtered list view (`isPinned = true`) |
| Backlinks | Context (Wave 1) | `context-backlinks-view.tsx` (entries sorted by incoming link count) |
| Calendar | Todos, Goals | `calendar-month-grid.tsx`, `calendar-day-detail.tsx` |
| Dashboard | All | `dashboard-page.tsx` (5 widgets) |

Board/Kanban view components exist (`goal-board-*.tsx`) but are dead code; removed from the view switcher.

## Key File Lookup

| Need to... | File |
|------------|------|
| Change auth (3-path `authenticate`) | `apps/web/lib/auth.ts` |
| Auth service internals (scrypt, JWT, sessions) | `apps/web/lib/services/auth-service.ts` |
| Add/modify Prisma model | `apps/web/prisma/schema.prisma` |
| Add validation schema (re-export) | `apps/web/lib/validations.ts` |
| Add shared Zod schema (authoritative) | `packages/core/src/schemas/<domain>.ts` |
| Add React Query key | `apps/web/lib/queries/keys.ts` |
| Change cache timing | `apps/web/lib/offline/cache-config.ts` |
| Modify UI state | `apps/web/lib/stores/ui-store.ts` |
| Change middleware (auth redirect gate) | `apps/web/middleware.ts` |
| Change web HTTP client | `apps/web/lib/api-client.ts` |
| Change shared HTTP client primitive | `packages/api-client/src/client.ts` |
| Change storage adapter | `packages/storage/src/web.ts` (web impl) |
| Change design tokens | `packages/ui-tokens/src/{colors,spacing,typography,radii}.ts` |
| Change graph layout / node + edge colors | `packages/graph/src/{layout,colors}.ts` |
| Wikilink parser | `packages/core/src/wikilink.ts` |
| Context link CRUD + content-sync | `apps/web/lib/services/context-link-service.ts` |
| Graph + neighbors + related heuristic | `apps/web/lib/services/context-service.ts` (`getGraph`, `getNeighbors`, `getRelated`) |
| Graph MCP tools | `apps/web/lib/mcp/tools/context-graph-tools.ts` |
| Graph view UI | `apps/web/components/context/context-graph-view.tsx` + `context-graph-node.tsx` |
| Edges panel in detail | `apps/web/components/context/context-edges-panel.tsx` |
| Quick link dialog | `apps/web/components/context/context-quick-link-dialog.tsx` |
| Entry type selector | `apps/web/components/context/context-type-select.tsx` |
| Backlinks view | `apps/web/components/context/context-backlinks-view.tsx` |
| Add nav item | `apps/web/components/layout/nav-config.ts` |
| Add MCP tool schema | `apps/web/lib/mcp/schemas.ts` |
| Route MCP tool | `apps/web/lib/mcp/server.ts` |
| Change XP/level constants | `apps/web/lib/constants.ts` |
| Filter goal trees | `apps/web/lib/tree-filter.ts` |
| Timeline date math | `apps/web/lib/timeline-utils.ts` |
| Seed or reset a user's password | `apps/web/scripts/set-password.ts` (CLI only) |
| Add/change file upload routes | `apps/web/app/api/files/{presign,confirm}/route.ts` + `apps/web/lib/services/file-service.ts` |

## Cross-Platform Rules (Wave 0+)

The monorepo splits code into shared packages (`packages/*`) and platform-specific apps (`apps/*`). These rules enforce the boundary so shared code stays platform-agnostic.

### What may live in `packages/*`

Pure TypeScript, Zod schemas, date-fns utilities, platform-agnostic business logic, shared types, and workspace cross-package imports. Nothing in a shared package may assume a specific runtime (browser, Node, React Native).

### What may NOT live in `packages/*`

The following imports are **banned** in any file under `packages/`:

| Banned import | Reason |
|---------------|--------|
| `next/*`, `next-themes` | Next.js is web-only |
| `react`, `react-dom` | React is a UI framework; shared packages contain logic, not UI |
| `react-native` | Platform-specific |
| `@prisma/client`, `@/lib/db` | Database access belongs in the service layer inside `apps/web` |
| `zustand` | State management is app-level |
| `localStorage`, `sessionStorage` (direct access in shared APIs) | Use `@ascend/storage` adapter instead |
| `window`, `document` (unguarded) | Not available in non-browser runtimes |
| Tailwind class strings, shadcn component imports | CSS framework is web-specific |

**Exception:** `packages/storage/src/web.ts` may reference `localStorage` and `window` because the entire purpose of that module is to provide the web implementation of the storage adapter. It guards access with `typeof window !== "undefined"`.

### What may live in `apps/web/*`

Any web library: Next.js, React, React DOM, Prisma, Zustand, Tailwind, shadcn, sonner, recharts, lucide-react, etc. All imports that are banned in `packages/*` are allowed here.

### Placement rules

| Code type | Where it lives |
|-----------|---------------|
| API route handlers | `apps/web/app/api/`, never in packages |
| Zustand store | `apps/web/lib/stores/`, using `@ascend/storage` adapter (never `localStorage` directly) |
| React Query hooks | `apps/web/lib/hooks/`, using `@ascend/api-client` (never raw `fetch` or `fetchJson`) |
| Shared types and enums | `@ascend/core` |
| Client-server contract (typed API client) | `@ascend/api-client` |
| Design tokens (colors, spacing, typography, radii) | `@ascend/ui-tokens` |
| Storage adapter interface and implementations | `@ascend/storage` |

### Enforcement

Run `ax:cross-platform-check` after any change to `packages/*`. The check greps for banned imports and fails if any are found. The `ascend-architect` agent verifies boundary compliance during code review.

## Danger Zones

**DZ-1: No transaction wrapping in todo completion.** `lib/services/todo-service.ts` and `lib/services/gamification-service.ts` perform status update, goal progress recalc, XP event creation, and stats update as separate Prisma calls. A mid-flow failure leaves data inconsistent.

**DZ-2: Context search_vector not in Prisma schema.** Added via raw SQL migration. Prisma does not know about it. See safety rule 6.

**DZ-3: Two separate recurring systems.** `lib/services/recurring-service.ts` (goals) and `lib/services/todo-recurring-service.ts` (todos) handle recurrence independently. Naming is confusing and there may be shared logic.

**DZ-4: Recurring instance generation is visit-triggered.** `todo-recurring-service.ts` only generates instances when the calendar page loads. If the user does not visit the calendar, recurring todos will not appear.

**DZ-5: fetchJson duplicated.** RESOLVED in Wave 0 Phase 4. Retained here as historical context only; no longer active. The hooks now import from `@ascend/api-client`.

**DZ-6: Board view components are dead code.** `components/goals/goal-board-card.tsx`, `goal-board-column.tsx`, `goal-board-view.tsx` were removed from the view switcher. Do not treat these as active components.

**DZ-7: No error boundaries.** A render error in any widget crashes the entire page. If adding a risky component or a new top-level page, wrap it in an error boundary. Mitigated for the `(auth)` route group via `apps/web/app/(auth)/error.tsx`.

**DZ-8: ContextLink.userId is denormalized.** Every query touching the ContextLink table MUST filter by userId (either directly in the where clause or via a preceding ownership check on the endpoint entries). The denormalized column exists specifically so Safety Rule 1 can be enforced on join-table queries without needing to traverse fromEntry/toEntry. See `apps/web/lib/services/context-link-service.ts` — every method verifies ownership before touching ContextLink. This was added in Wave 1 Phase 1.

## Deployment

Deployed via Dokploy (dokploy-personal) to `ascend.nativeai.agency`. Auto-deploys on push to main via GitHub provider. Docker build from the root `Dockerfile`.

@import rules/ascend-workflow.md
@import rules/service-patterns.md
@import rules/api-route-patterns.md
@import rules/component-patterns.md
@import rules/mcp-tool-patterns.md
@import rules/accessibility.md
