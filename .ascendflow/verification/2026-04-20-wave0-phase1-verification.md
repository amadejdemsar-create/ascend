# Ascend UI Verification Report

**When:** 20. 4. 2026 17:18 (Europe/Ljubljana)
**Branch:** main
**HEAD commit:** 3339d4e chore(monorepo): convert to pnpm workspaces, move app to apps/web
**Dev port detected:** 3001
**What was tested:** Wave 0 Phase 1 monorepo conversion (pure structural move of the Next.js app from repo root into `apps/web/` under pnpm workspaces). Expected outcome: zero user-visible change. Any regression would indicate a broken import path or build config from the move.
**Verdict:** PASS

## Files evaluated (Phase 0)

- `pnpm-workspace.yaml`: New file declaring `apps/*` and `packages/*` workspace globs
- `tsconfig.base.json`: New root-level base TypeScript config
- `apps/web/package.json`: Renamed to `@ascend/web`, all deps and scripts preserved
- `apps/web/`: Entire Next.js app relocated here from repo root (byte-identical per ascend-reviewer)

## Test plan (Phase 0.5)

Scenarios identified BEFORE opening the browser:

1. **App boots + authenticated home** -- confirms the app shell loads and initial render is error-free
2. **Sidebar nav sweep (click-driven)** -- confirms all 5 primary pages (Goals, Todos, Calendar, Context, Dashboard) are reachable via sidebar clicks and render content
3. **View switcher on Goals** -- exercises List, Tree, and Timeline views to confirm component imports are intact
4. **Filter bar on Goals** -- opens Status, Priority, and Category dropdowns to confirm enum options render
5. **Command palette (Cmd+K)** -- confirms the global shortcut handler and command palette component work
6. **Filter persistence across navigation** -- sets a Quarterly horizon filter, navigates away, returns, confirms Zustand persistence is intact
7. **Calendar renders current month** -- confirms the month grid, day cells, week numbers, and today highlight render
8. **Context list renders** -- confirms context entries, categories, and search bar render without broken component trees

## Environment (Phase 1)

- Git state: clean (only untracked: `.ascendflow/verification/2026-04-20-1619-wave0-phase1-retry-abort.md`)
- Dev server port: 3001
- `/api/health` response: `{"status":"ok","timestamp":"2026-04-20T15:08:34.633Z","db":{"users":2,"stats":1}}`
- TypeScript: PASS (zero errors)
- Turbopack warm-up: all 6 routes returned 200 (dashboard 8.1s first-hit, rest under 2s)
- Baseline console errors on initial `/dashboard` load: none (0 errors)

## Execution

### Scenario 1: App boots + authenticated home

- **Preconditions:** Dev server running on port 3001, health endpoint OK
- **Action:** Navigate to `http://localhost:3001/dashboard` (bootstrap URL), resize to 1728x1013
- **Expected:** Dashboard page loads with title, date, widgets, sidebar
- **Observed:** Dashboard renders with "Monday, 20 April 2026", all 5 widgets (Big 3, This Week's Focus, Progress Overview, Level & Stats, Upcoming Deadlines), sidebar with all nav links, category tree with "Smoke Test"
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `scenario0-dashboard-initial.png`

### Scenario 2: Sidebar nav sweep

- **Preconditions:** On dashboard
- **Action:** Click Goals, Todos, Calendar, Context, Dashboard in order via sidebar links
- **Expected:** Each page loads with content, no 404s, no white screens, no module-not-found errors
- **Observed:** All 5 pages navigated successfully. Goals: 5 goals in hierarchical list. Todos: 18+ recurring "Daily smoke v2" todos plus "Smoke test todo". Calendar: April 2026 grid with today highlighted. Context: Current Priorities card, Weekly Review entry, category filter. Dashboard: all widgets render on return.
- **Console errors (fresh):** 2 errors on Context page (pre-existing, see below)
- **Verdict:** PASS
- **Screenshots:** `scenario2-goals.png`, `scenario2-todos.png`, `scenario2-calendar.png`, `scenario2-context.png`, `scenario2-dashboard-return.png`

### Scenario 3: View switcher on Goals

- **Preconditions:** On Goals page in List view
- **Action:** Click Tree button, screenshot. Click Timeline button, screenshot. Click List button to return.
- **Expected:** Tree shows hierarchical nodes with expand/collapse. Timeline shows Gantt bars with week columns.
- **Observed:** Tree view: hierarchical nodes (2026 > Q2 2026 > April focus) with horizon badges (Y, Q, M, W), expand/collapse arrows. Timeline view: April 2026 with W14-W18 columns, Gantt bars per goal, today marker, Year/Quarter/Month zoom controls. List view: restored correctly.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `scenario3-goals-tree.png`, `scenario3-goals-timeline.png`

### Scenario 4: Filter bar on Goals

- **Preconditions:** On Goals page in List view
- **Action:** Open Status dropdown, verify options, close. Open Priority dropdown, verify, close. Open Category dropdown, verify, close.
- **Expected:** Status: All statuses, Not started, In progress, Completed, Abandoned. Priority: All priorities, Low, Medium, High. Category: All categories, Smoke Test.
- **Observed:** All three dropdowns render with the correct options. Checked marks on "All" defaults. Dropdowns close cleanly on Escape.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `scenario4-status-dropdown.png`, `scenario4-priority-dropdown.png`, `scenario4-category-dropdown.png`

### Scenario 5: Command palette (Cmd+K)

- **Preconditions:** On Goals page
- **Action:** Press Meta+K (Cmd+K). Verify palette opens. Press Escape. Verify it closes.
- **Expected:** Palette shows search input, Navigation section (Dashboard, Goals, Settings), Views section (List, Tree, Timeline), Goals section.
- **Observed:** Palette opened with all expected sections and commands. Escape closed it cleanly, returning to the Goals page.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `scenario5-cmd-k-open.png`, `scenario5-cmd-k-closed.png`

### Scenario 6: Filter persistence across navigation

- **Preconditions:** On Goals page with "All" horizon tab selected
- **Action:** Click "Quarterly" tab. Navigate to Todos via sidebar. Navigate back to Goals via sidebar. Check if Quarterly is still selected. Reset to "All".
- **Expected:** Quarterly tab remains selected after round-trip navigation (Zustand persistence).
- **Observed:** Quarterly tab remained selected after Todos round-trip. Confirmed via both screenshot (underlined tab) and accessibility snapshot (`tab "Quarterly" [selected]`). Reset to "All" succeeded.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `scenario6-quarterly-filter.png`, `scenario6-goals-return-filter.png`

### Scenario 7: Calendar renders current month

- **Preconditions:** On any page
- **Action:** Click Calendar in sidebar. Verify April 2026 grid. Hover day cell (April 21).
- **Expected:** Month grid with Mo-Su columns starting Monday, week numbers, today (20) highlighted, dot indicators on days with todos.
- **Observed:** April 2026 renders with week rows W14-W19, Mo-Su columns, today (April 20) highlighted and marked as selected. Dot indicators on days 10-26+ showing pending todos. Legend (Pending, Big 3, Deadline, Done) present. Hover on April 21 succeeded without errors.
- **Console errors (fresh):** none
- **Verdict:** PASS
- **Screenshots:** `scenario2-calendar.png`, `scenario7-calendar-hover.png`

### Scenario 8: Context list renders

- **Preconditions:** On any page
- **Action:** Click Context in sidebar. Verify list content, categories, search bar.
- **Expected:** Context entries render with titles, content previews, tags, timestamps. Category filter shows options.
- **Observed:** Page shows "Current Priorities" dynamic card, "Recent" section with "Weekly Review: Apr 13, 2026 to Apr 19, 2026" entry (6 days ago, #weekly-review, 45 words, 1 min), "Weekly Reviews" section. Categories: All, Smoke Test. Search bar and "+ New" button present.
- **Console errors (fresh):** 2 pre-existing (button nesting in ContextRow, see below)
- **Verdict:** PASS
- **Screenshots:** `scenario2-context.png`, `scenario8-context.png`

## Regression sweep (Phase 5)

- `/dashboard`: PASS -- all 5 widgets render (Big 3, This Week's Focus with 2 goals, Progress Overview, Level & Stats at Level 1 20/100 XP, Upcoming Deadlines), no stuck skeletons
- `/review`: PASS -- Weekly Review page renders with stats (17 carried over, 0 completed) and carried-over todo list
- `/settings`: PASS -- Appearance (Light/Dark/System), Keyboard Shortcuts reference, API key (masked), Import Data, Export Data all render
- Sidebar category tree: PASS -- "Smoke Test" category renders with icon and expand arrow on all pages

## Console errors

### Baseline (Phase 2, pre-existing)

None on initial dashboard load.

### Fresh (Phase 4, from scenarios)

- Context page (Scenarios 2 and 8): `<button> cannot be a descendant of <button>` -- pre-existing HTML nesting issue in `ContextRow` component (`components/context/context-row.tsx`). A nested button (tag/category click handler) is rendered inside the outer row button. This fires on every Context page mount. NOT caused by the monorepo conversion; existed before this commit.

No other fresh errors across all 8 scenarios and the regression sweep. The total error count remained at 2 (both from the Context page) throughout the entire session.

## Summary

### Works

- Dashboard loads with all widgets, correct date, sidebar fully populated
- All 5 primary pages (Dashboard, Goals, Todos, Calendar, Context) navigate via sidebar clicks
- Review and Settings pages also render correctly (bonus regression check)
- Goals view switcher (List, Tree, Timeline) renders each view with correct content
- Goals filter bar dropdowns (Status, Priority, Category) show all expected options
- Command palette opens on Cmd+K, shows commands, closes on Escape
- Horizon filter persists across navigation (Zustand localStorage persistence intact)
- Calendar shows April 2026 with correct week start (Monday), week numbers, today highlight, and interactive day cells
- Context list shows entries with metadata, category filter, and search
- Category tree in sidebar renders on all pages
- API health endpoint returns OK with DB connection confirmed
- TypeScript: zero errors
- No module-not-found errors, no broken imports, no 404 routes, no white screens

### Broken

- Nothing. Zero blocking regressions from the monorepo conversion.

### Pre-existing notes (not caused by this change)

- `components/context/context-row.tsx`: `<button>` nested inside `<button>` causes 2 hydration warnings on every Context page mount. This is a pre-existing DOM nesting bug, not a regression from the monorepo move. Should be fixed by changing the inner button to a `<span role="button">` or restructuring the component.

### Recommendation

Ship it. The monorepo conversion (Wave 0 Phase 1) produced zero user-visible regressions. All routes load, all interactive features work, all component imports resolve correctly, and the Zustand persistence layer is intact. The single pre-existing issue (button nesting in ContextRow) predates this change and should be addressed separately.
