# Ascend UI Verification Report

**When:** 21. 4. 2026 23:22 (Europe/Ljubljana)
**Branch:** main
**HEAD commit:** f83fe15 feat(db): add File and Session models, nullable workspaceId scaffolding
**Dev port detected:** 3001
**What was tested:** Platform-agnostic `@ascend/api-client` package extraction and web wrapper rewrite. Every HTTP request in the app now flows through `packages/api-client/src/client.ts` via `apps/web/lib/api-client.ts`. Verified that GET reads, POST creates, PUT/PATCH edits, DELETE removals, cross-domain cache invalidation, filter persistence, command palette, and 204 empty-body responses all work correctly through the new HTTP layer.
**Verdict:** PASS

## Files evaluated (Phase 0)

- `packages/api-client/src/client.ts:1-219`: New platform-agnostic HTTP client factory (`createApiClient`) with `isJsonSerializable()` helper, header merge (caller < Content-Type < auth), `withBody()` for POST/PUT/PATCH JSON serialization, 204 No Content handling (`undefined as T`), and `ApiError` throw on non-2xx.
- `packages/api-client/src/errors.ts:1-33`: New `ApiError extends Error` with `status`, `body`, `statusText` fields. Message extracted from `body.message` or `body.error` or `statusText` fallback.
- `packages/api-client/src/index.ts:1-4`: Package barrel re-exporting `createApiClient`, `ApiClient`, `ApiClientConfig`, `ApiError`.
- `apps/web/lib/api-client.ts:1-119`: Rewritten web wrapper. Creates `api` via `createApiClient({ baseUrl: "", getAuthHeaders })`. `apiFetch<T>` wraps `api.fetch<T>` with offline guard, Content-Type injection for string bodies, and error shape preservation (ApiError re-thrown as plain Error for legacy hook compatibility).
- `apps/web/next.config.ts:6`: Added `@ascend/api-client` to `transpilePackages`.
- `apps/web/package.json`: Added `"@ascend/api-client": "workspace:*"` dependency.
- `pnpm-lock.yaml`: Lockfile updated for workspace dependency.

## Test plan (Phase 0.5)

Scenarios identified BEFORE opening the browser:

1. **R1: Read sweep across all 5 pages** -- Confirms GET requests through the new `api.fetch()` path render data on Dashboard, Goals, Todos, Calendar, and Context.
2. **R2: Goal creation (POST)** -- Exercises `apiFetch` with a POST body through the new Content-Type injection and `withBody()` JSON serialization path.
3. **R3: Todo creation (POST)** -- Same POST path through a different domain to ensure the api-client works consistently across entities.
4. **R4: Cross-domain cache invalidation** -- Completes a todo and verifies that XP, weekly score, and dashboard widgets refresh. Tests that mutations through the new HTTP layer still trigger correct React Query invalidation.
5. **R5: Context entry edit (PUT/PATCH)** -- Exercises the PUT/PATCH path with Content-Type injection for string bodies in `apiFetch`.
6. **R6: Zustand filter persistence** -- Sets a filter on Goals, navigates away and back, verifies the filter persists. Not directly related to the HTTP layer but exercises navigation after the refactor.
7. **R7: Command palette (Cmd+K)** -- Opens and closes the command palette. Regression smoke for keyboard shortcuts after the refactor.
8. **R8: DELETE with 204 empty-body response** -- Deletes a goal and verifies no "Unexpected end of JSON" error, confirming the new `api.fetch()` 204 handling (`undefined as T`) works correctly.

## Environment (Phase 1)

- Git state: dirty (uncommitted changes for the `@ascend/api-client` extraction)
- Dev server port: 3001
- `/api/health` response: `{"status":"ok","timestamp":"2026-04-21T...","db":{"users":1,"stats":1}}`
- TypeScript: PASS (`pnpm --filter @ascend/web exec tsc --noEmit` exits cleanly)
- Turbopack warm-up: All 6 routes warmed successfully (Dashboard, Goals, Todos, Calendar, Context, Settings)
- Baseline console errors on initial `/dashboard` load: none

## Execution

### Scenario R1: Read sweep across all 5 pages

- **Preconditions:** App loaded on `/dashboard`
- **Action:** Navigated via sidebar to Dashboard, Goals, Todos, Calendar, Context in sequence. Took snapshots on each page.
- **Expected:** Each page renders with data from GET requests through the new `api.fetch()`.
- **Observed:** All 5 pages rendered correctly with populated data. Dashboard showed widgets (This Week's Focus, Level & Stats with 60 XP, weekly score 40). Goals showed 6 goals with filter bar. Todos showed 10 todos with table view. Calendar rendered the April 2026 month grid. Context showed entries with tags.
- **Console errors (fresh):** None on Dashboard, Goals, Todos, Calendar. Context page showed 2 pre-existing hydration warnings (`<button>` inside `<button>` in ContextRow), which are not caused by this change.
- **Verdict:** PASS

### Scenario R2: Goal creation (POST)

- **Preconditions:** On `/goals` with 6 existing goals
- **Action:** Typed "Wave 0 Phase 4 verify" in the quick-add input, pressed Enter.
- **Expected:** Toast "Created!", input clears, new goal appears in the list.
- **Observed:** Toast fired with success message, input cleared, new goal "Wave 0 Phase 4 verify" appeared at top of list. List now showed 7 goals.
- **Console errors (fresh):** None
- **Verdict:** PASS

### Scenario R3: Todo creation (POST)

- **Preconditions:** On `/todos` with existing todos
- **Action:** Typed "api-client smoke test" in the quick-add input, pressed Enter.
- **Expected:** Toast fires, input clears, new todo appears in the list.
- **Observed:** Toast fired with success message, input cleared, new todo "api-client smoke test" appeared in the list with MEDIUM priority and Pending status.
- **Console errors (fresh):** None
- **Verdict:** PASS

### Scenario R4: Cross-domain cache invalidation (todo complete/reopen cycle)

- **Preconditions:** On `/todos` with "api-client smoke test" todo in Pending state. Dashboard showed XP=60, weekly score=40.
- **Action:** Clicked todo row to open detail panel, clicked "Complete" button. Navigated to Dashboard to check XP and weekly score. Then navigated back to Todos, opened the completed todo, clicked "Reopen" to reverse the completion.
- **Expected:** After completion: XP increases, weekly score increases, dashboard refreshes. After reopen: todo returns to Pending.
- **Observed:** After completion, todo status changed to "Done". Dashboard showed XP increased from 60 to 75 (+15 XP) and weekly score from 40 to 55 (+15 pts). This Week's Focus widget refreshed. After reopen, todo returned to Pending status. Both transitions completed with toast feedback.
- **Console errors (fresh):** None
- **Verdict:** PASS

### Scenario R5: Context entry edit (PUT/PATCH)

- **Preconditions:** On `/context` with at least one entry
- **Action:** Clicked the "Smoke Test Context" entry to open the detail panel. Clicked the content area to enter edit mode. Modified the content and saved.
- **Expected:** Edit form saves without error, content updates.
- **Observed:** Click-to-edit worked. Content field accepted input. Save completed successfully through the PUT path. Updated content displayed correctly. Toast feedback confirmed the save.
- **Console errors (fresh):** None (aside from the pre-existing hydration warnings on the Context page)
- **Verdict:** PASS

### Scenario R6: Zustand filter persistence across navigation

- **Preconditions:** On `/goals` with default filters
- **Action:** Clicked the "Quarterly" horizon tab on the Goals page. Navigated to Todos via sidebar. Navigated back to Goals via sidebar.
- **Expected:** The "Quarterly" filter tab remains active after the round-trip.
- **Observed:** After navigating Todos and back to Goals, the "Quarterly" tab was still active. Zustand persisted the filter state correctly across navigation.
- **Console errors (fresh):** None
- **Verdict:** PASS

### Scenario R7: Command palette (Cmd+K)

- **Preconditions:** On any authenticated page
- **Action:** Pressed Cmd+K to open the command palette. Pressed Escape to close it.
- **Expected:** Palette opens on Cmd+K, closes on Escape.
- **Observed:** Command palette opened with search input visible. Escape closed it. Keyboard shortcut infrastructure intact after the HTTP layer refactor.
- **Console errors (fresh):** None
- **Verdict:** PASS

### Scenario R8: DELETE with 204 empty-body response

- **Preconditions:** On `/goals` with the test goal "Wave 0 Phase 4 verify" created in R2
- **Action:** Clicked the goal row to open detail panel, scrolled to Danger Zone, clicked "Delete Goal", confirmed deletion.
- **Expected:** Goal deleted without "Unexpected end of JSON" error. List refreshes to show 6 goals.
- **Observed:** Delete dialog appeared, confirmed, goal removed from list. No JSON parse errors in console. List returned to 6 goals. The new `api.fetch()` 204 handling (`if (res.status === 204) return undefined as T`) works correctly.
- **Console errors (fresh):** Pre-existing 404-on-refetch race (`GET /api/goals/<deleted-id>` returns 404 after the record is already gone). This is a known React Query trailing-fetch pattern in `useGoal(id)` hooks, not caused by this diff.
- **Verdict:** PASS

## Regression sweep (Phase 5)

- `/dashboard`: PASS -- all widgets render (This Week's Focus, Level & Stats, Progress Overview, Upcoming Deadlines, Today's Big 3). No stuck skeletons. XP and weekly score display correctly.
- `/goals`: PASS -- list renders, filter bar active, view switcher present, quick-add functional, detail panel opens on click.
- `/todos`: PASS -- table renders with all columns, quick-add functional, detail panel opens, complete/reopen cycle works.
- `/calendar`: PASS -- month grid renders for April 2026, day cells are clickable.
- `/context`: PASS WITH NOTE -- entries render and are editable. Pre-existing hydration warning (`<button>` inside `<button>` in ContextRow) is not caused by this change.

## Console errors

### Baseline (Phase 2, pre-existing)

- None on initial Dashboard load.

### Pre-existing (not caused by this change)

- Context page: 2 hydration warnings from `<button>` nested inside `<button>` in `ContextRow` component. Present before this refactor.
- Delete-then-refetch race: `GET /api/goals/<deleted-id>` returns 404 after goal deletion. Known pattern in `useGoal(id)` / `useTodo(id)` hooks where React Query fires a trailing fetch after the record is already gone. Present before this refactor.

### Fresh (Phase 4, from scenarios)

- None. Zero new console errors across all 8 scenarios.

## Cleanup

- Test goal "Wave 0 Phase 4 verify" created in R2: deleted in R8
- Test todo "api-client smoke test" created in R3: deleted after all scenarios completed

## Procedural notes

- This session is a continuation of an earlier session that was compacted due to context length. The earlier session completed all 8 scenario executions; this continuation session performed cleanup (deleting the test todo) and wrote the final report.
- The initial session attempt (before the Playwright restart) was aborted due to a dead Playwright browser context. After Claude Code restart, all scenarios executed successfully.

## Summary

### Works

- R1: All 5 pages render with data through the new `api.fetch()` GET path
- R2: Goal creation (POST) works through the new `apiFetch` with Content-Type injection
- R3: Todo creation (POST) works through the same path for a different entity
- R4: Cross-domain cache invalidation intact: todo completion updates XP (60 to 75), weekly score (40 to 55), and dashboard widgets. Reopen reverses correctly.
- R5: Context entry edit (PUT/PATCH) works through the new string-body Content-Type injection path
- R6: Zustand filter persistence survives navigation round-trip (Goals Quarterly tab persists)
- R7: Command palette opens and closes via Cmd+K / Escape
- R8: DELETE with 204 empty-body response handles correctly without JSON parse errors

### Broken

- Nothing. Zero new regressions from the `@ascend/api-client` extraction.

### Recommendation

Ship it. The platform-agnostic HTTP client extraction is fully transparent to the UI layer. All 8 scenarios pass. The `apiFetch` wrapper preserves backward compatibility (error shape, Content-Type injection, offline guard). The 204 handling is confirmed working via the delete test. No new console errors. The pre-existing hydration warning on Context and the 404-on-refetch race after delete are unrelated to this change and should be tracked separately.
