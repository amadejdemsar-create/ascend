# Ascend UI Verification Report

**When:** 22. 4. 2026 17:23 (Europe/Ljubljana)
**Branch:** main
**HEAD commit:** 3bda502 docs(spike): Lexical viability evaluation for W3 block editor
**Dev port detected:** 3001
**What was tested:** Full regression sweep of all existing Ascend surfaces (Dashboard, Goals, Todos, Context, Calendar, Settings, Review, Analytics) after Wave 0 platform foundation changes (monorepo conversion, shared packages, JWT auth, file upload scaffolding). The Wave 0 PRD promises zero user-visible regressions; this report validates that promise.
**Verdict:** PASS

## Files evaluated (Phase 0)

Wave 0 touched 369 files across 10 commits. Key changes:

- `apps/web/app/(auth)/login/`: new JWT login flow with email/password form
- `apps/web/app/api/auth/`: login, logout, refresh, me routes
- `apps/web/lib/api-client.ts`: cookie-based auth with 401 refresh-and-retry interceptor
- `apps/web/app/(app)/layout.tsx`: added `SessionExpiredListener` component
- `packages/core/`, `packages/api-client/`, `packages/storage/`, `packages/ui-tokens/`: new shared packages
- `pnpm-workspace.yaml`, `tsconfig.base.json`: monorepo workspace config
- `prisma/schema.prisma`: added File, Session models, user passwordHash field
- All `app/`, `components/`, `lib/`, `prisma/`, `public/`, `test/` directories moved under `apps/web/`

## Test plan (Phase 0.5)

Scenarios identified BEFORE opening the browser:

1. **S0: Login** -- Verify unauthenticated redirect, login form, successful auth redirect
2. **S1: Dashboard renders all widgets** -- Today's Big 3, This Week's Focus, Progress Overview, Level & Stats, Upcoming Deadlines
3. **S2: Goals CRUD** -- List rendering, detail panel, quick-add, delete with confirmation
4. **S3: Todos CRUD** -- List rendering, quick-add, complete/uncomplete cycle, delete
5. **S4: Context view** -- Entry list, detail panel with rendered markdown
6. **S5: Calendar view** -- Month grid, today highlight, month navigation
7. **S6: Filter persistence** -- Set priority filter on goals, navigate away and back, verify retention
8. **S7: Logout + redirect guard** -- Sign out, cookie clearing, direct URL access blocked
9. **S8: Theme toggle** -- Light/Dark/System cycle
10. **S9: Command palette** -- Cmd+K opens, search filters, Escape closes
11. **S10: Console error sweep** -- No new errors introduced

## Environment (Phase 1)

- Git state: clean (no uncommitted files)
- Dev server port: 3001
- `/api/health` response: `{"status":"ok","timestamp":"2026-04-22T15:02:38.106Z","db":{"users":2,"stats":1}}`
- TypeScript: PASS (zero errors from `npx tsc --noEmit`)
- Route warm-up: all 9 routes responded (login 200, all app routes 307 redirect to login)
- Baseline console errors on initial `/login` load: none

## Execution

### Scenario 0: Login

- **Preconditions:** Fresh browser, no auth cookies
- **Action:** Navigate to `/`. Fill email `dev@ascend.local` and password. Click Sign in.
- **Expected:** Redirect to `/login?redirect=%2F` on unauthenticated access. After login, redirect to `/`.
- **Observed:** Redirect to login worked correctly. Login succeeded. Post-login redirect to `/` showed the marketing landing page (not the app shell), which is by design since `/` is the public landing page. Clicking "Open App" navigated to `/dashboard` where the full app shell rendered.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `s0-login-page.png`, `s0-post-login-dashboard.png`

### Scenario 1: Dashboard renders all widgets

- **Preconditions:** Authenticated, on `/dashboard`
- **Action:** Inspect all 5 dashboard widgets
- **Expected:** All widgets render with data, no stuck skeletons
- **Observed:** All widgets rendered: Today's Big 3 (empty with "Set priorities" link), This Week's Focus (3 goals: Smoke test goal HIGH, Week 15 sprint HIGH, Test Goal Medium), Progress Overview (category assignment prompt), Level & Stats (Level 1, 60/100 XP, 40 pts weekly), Upcoming Deadlines (clear schedule). Date shows "Wednesday, 22 April 2026".
- **Console errors (fresh):** none
- **Verdict:** PASS

### Scenario 2: Goals CRUD

- **Preconditions:** Goals page with 6 existing goals
- **Action:** Navigate via sidebar click. View list. Open detail panel (Smoke test goal). Close panel. Quick-add "Wave 0 smoke" via Enter. Open new goal detail. Delete via confirmation dialog.
- **Expected:** List renders, detail panel opens with click-to-edit fields, quick-add creates goal (toast, input clears), delete removes goal.
- **Observed:** All operations worked. List rendered 6 goals with hierarchy indicators. Detail panel opened with Status, Priority, Measurable Target, Linked Todos, Deadline, Notes, Sub-goals, Danger Zone. Quick-add created "Wave 0 smoke" (appeared at top, input cleared). Delete showed confirmation dialog ("Delete Goal? This will permanently delete Wave 0 smoke"), goal removed from list.
- **Console errors (fresh):** 1 error: `404 /api/goals/<id>` (pre-existing trailing refetch after delete, documented in DZ)
- **Verdict:** PASS
- **Screenshots:** `s2-goals-list.png`, `s2-goal-detail-panel.png`, `s2-goal-quickadd-result.png`

### Scenario 3: Todos CRUD

- **Preconditions:** Todos page with 11 existing todos (recurring "Daily smoke v2")
- **Action:** Navigate via sidebar. Quick-add "Wave 0 todo smoke". Open detail panel. Complete (click Complete button). Uncomplete (click Mark incomplete). Delete via confirmation.
- **Expected:** CRUD cycle works end-to-end with status transitions.
- **Observed:** Quick-add created todo (input cleared, appeared in list as Pending/Medium). Detail panel showed Complete/Skip buttons, Priority, Focus, Due date, Category, Linked goal, Description, Danger Zone. Completing changed button to "Mark incomplete". Uncompleting restored "Complete" button. Delete showed confirmation dialog and removed todo.
- **Console errors (fresh):** 1 error: `404 /api/todos/<id>` (pre-existing trailing refetch after delete)
- **Verdict:** PASS
- **Screenshots:** `s3-todos-list.png`, `s3-todo-detail.png`, `s3-todo-completed.png`, `s3-todo-quickadd.png`

### Scenario 4: Context view

- **Preconditions:** Context page with existing entries
- **Action:** Navigate via sidebar. Click "Weekly Review: Apr 20, 2026 to Apr 26, 2026" entry.
- **Expected:** Entry list renders with categories. Detail panel shows rendered markdown.
- **Observed:** Context page rendered with search bar, category filters (All, Smoke Test), "Current Priorities" dynamic card with "Dynamic - live" badge, Recent section (1 entry), Weekly Reviews section (2). Detail panel opened showing rendered markdown (H2 headings "What went well", "What to improve"), tag `#weekly-review`, and metadata. Markdown rendering is correct.
- **Console errors (fresh):** 2 errors: nested `<button>` hydration warnings in ContextRow component (pre-existing, not new)
- **Verdict:** PASS
- **Screenshots:** `s4-context-list.png`, `s4-context-detail.png`

### Scenario 5: Calendar view

- **Preconditions:** Calendar page
- **Action:** Navigate via sidebar. Verify April 2026 renders. Click next month. Click previous month.
- **Expected:** Month grid with events, today highlighted, navigation works.
- **Observed:** April 2026 rendered with week numbers (W14-W19), Monday-first layout, today (22) highlighted in blue, colored dots (Pending gray, Big 3 yellow, Deadline red, Done green) on various days. Next month navigation showed "May 2026". Previous month returned to "April 2026". "Today" button present.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `s5-calendar.png`

### Scenario 6: Filter persistence

- **Preconditions:** Goals page, filters at default
- **Action:** Set priority filter to "HIGH" via dropdown. Navigate to Todos via sidebar. Navigate back to Goals.
- **Expected:** Priority filter still shows "HIGH" after round-trip navigation.
- **Observed:** Priority dropdown changed to "HIGH" with active filter badge showing "1". "Clear all" button enabled. After navigating to `/todos` and back to `/goals`, filter still showed "HIGH". Zustand persist working correctly.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `s6-filter-set.png`

### Scenario 7: Logout + redirect guard

- **Preconditions:** Authenticated session on goals page
- **Action:** Click "Sign out" in sidebar footer. Then navigate directly to `/dashboard`.
- **Expected:** Redirect to `/login` on logout. Direct URL access to `/dashboard` blocked, redirect to `/login?redirect=%2Fdashboard`.
- **Observed:** Sign out redirected to `/login`. Direct navigation to `/dashboard` redirected to `/login?redirect=%2Fdashboard`. Re-login with same credentials redirected to `/dashboard` (redirect param preserved correctly).
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `s7-logout.png`

### Scenario 8: Theme toggle

- **Preconditions:** Dashboard, light mode
- **Action:** Click theme toggle button. Cycle through modes.
- **Expected:** Dark mode applies, persists.
- **Observed:** Theme cycles through 3 states: light -> dark -> system -> light. Dark mode applied correctly (dark background, proper contrast on all widgets). HTML class toggled between "light" and "dark". Settings page shows Light/Dark/System selector confirming state.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `s8-dark-mode.png`

### Scenario 9: Command palette (Cmd+K)

- **Preconditions:** Dashboard
- **Action:** Press Cmd+K. Type "goal" to search. Press Escape.
- **Expected:** Palette opens, search filters results, Escape closes.
- **Observed:** Cmd+K opened dialog with search input "Search goals, todos, context...". Initial suggestions: Navigation (Go to Dashboard, Goals, Settings), Views (List, Tree, Timeline), Goals (Create New/Yearly/Weekly), Theme (Light/Dark/System), Filter (Smoke Test). Typing "goal" filtered to matching goals (Test Goal - Learn TypeScript, Smoke test goal) and goal-related commands. Escape closed the dialog.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `s9-command-palette.png`

### Scenario 10: Console error sweep

- **Preconditions:** Entire session complete
- **Action:** Review all console errors across the full session.
- **Expected:** No new errors from Wave 0 changes.
- **Observed:** 4 total console errors, all pre-existing:
  1. `404 /api/goals/<id>`: trailing refetch after goal delete (DZ-documented)
  2. `404 /api/todos/<id>`: trailing refetch after todo delete (DZ-documented)
  3. Nested `<button>` hydration warning on Context page (pre-existing ContextRow issue)
  4. Nested `<button>` ancestor stack trace (same issue)
  No new errors were introduced by any Wave 0 change.
- **Verdict:** PASS

## Regression sweep (Phase 5)

- `/dashboard`: PASS -- all 5 widgets render, XP system functional (70/100 XP, 50 pts weekly score reflects test activity)
- `/goals`: PASS -- list, detail panel, quick-add, delete, filter bar, view switcher all operational
- `/todos`: PASS -- list, quick-add, complete/uncomplete cycle, delete all operational
- `/context`: PASS -- entries render, detail panel shows markdown, search present (pre-existing nested button warning)
- `/calendar`: PASS -- month grid renders with events, today highlighted, month navigation works
- `/settings`: PASS -- Appearance (Light/Dark/System) and Keyboard Shortcuts sections render correctly
- `/review`: PASS -- Weekly Review shows stats (5 completed, 13 carried over, 50 XP), completed/carried-over lists, week navigation
- `/analytics`: PASS -- Stats cards (5 todos, 50 XP, 1 goal progressed), bar chart (Todo Completions by week), line chart (XP Earned), Goal Progress Velocity chart all render with data

## Console errors

### Baseline (Phase 2, pre-existing)

None on initial `/login` page load.

### Fresh (Phase 4, from scenarios)

All errors are pre-existing, not caused by Wave 0 changes:

- Scenario 2: `GET /api/goals/<id>` 404 -- pre-existing trailing refetch after delete (DZ-documented in useGoal(id) hook)
- Scenario 3: `GET /api/todos/<id>` 404 -- pre-existing trailing refetch after delete (DZ-documented in useTodo(id) hook)
- Scenario 4: nested `<button>` hydration warning -- pre-existing in `ContextRow` component (`apps/web/components/context/context-entry-list.tsx`)

## Summary

### Works

- Login/logout with JWT cookie-based auth: redirect to login on unauthenticated access, redirect back on successful login, session cookies cleared on logout, redirect guard blocks direct URL access
- Dashboard: all 5 widgets render (Today's Big 3, This Week's Focus, Progress Overview, Level & Stats, Upcoming Deadlines)
- Goals: full CRUD cycle (list, detail panel, quick-add, delete), filter bar with Zustand persistence, view switcher, horizon tabs
- Todos: full CRUD cycle (quick-add, complete, uncomplete, delete), filter tabs (Today & Overdue, This Week, All)
- Context: entry list with categories, detail panel with rendered markdown, search bar
- Calendar: month grid with event dots, today highlight, month navigation
- Settings: appearance selector, keyboard shortcuts reference
- Review: weekly stats, completed/carried-over todo lists, week navigation
- Analytics: summary cards, bar chart, line chart, velocity chart with real data
- Command palette: Cmd+K opens, search filters, Escape closes
- Theme toggle: 3-state cycle (light/dark/system), both themes render correctly
- Filter persistence: Zustand-persisted filters survive cross-page navigation
- Gamification: XP awards tracked correctly (todo completion awarded XP, reflected in stats)
- Sidebar: all 8 nav items present (Dashboard, Calendar, Review, Analytics, Todos, Goals, Context, Settings), category tree rendered

### Broken

Nothing. Zero new regressions detected.

### Pre-existing issues (not caused by Wave 0)

- Trailing 404 refetch after entity deletion in goal and todo detail panels (DZ-documented)
- Nested `<button>` hydration warning in Context page ContextRow component
- Theme toggle button label shows "Switch to light mode" when already in light mode on first render (off-by-one in the cycle label, cosmetic)

### Recommendation

Ship. Wave 0 platform foundation changes introduce zero user-visible regressions. All 8 pages render correctly. All CRUD operations work end-to-end. Auth flow (login, logout, redirect guard, session cookies) functions correctly. The monorepo restructuring, shared package extraction, and JWT auth migration have not broken any existing surface.
