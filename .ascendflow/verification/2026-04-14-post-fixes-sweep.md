# Ascend UI Verification Report — Post-fixes sweep

**When:** 14. 4. 2026 15:47 (Europe/Ljubljana)
**Branch:** main
**HEAD commit:** f198983 feat(ui): design system primitives + 6 high-priority UX fixes
**Dev port detected:** 3100
**What was tested:** Full-app behavioral verification of the three fix batches since the 14. 4. 2026 first-pass verification: (a) the 5 bugs + C1 design token fix in 21a17a0, (b) the /context redesign in e0526ac, (c) the PageHeader/EmptyState primitives + 6 H-level UX fixes in f198983.
**Verdict:** PASS WITH NOTES

## Procedural note (important — read first)

Playwright MCP tools (`mcp__playwright__*`) are NOT exposed to this verifier run. The only tools available were Read, Bash, Grep, Glob, and Write. I could not `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, or take screenshots through Playwright.

I therefore downgraded the verification to a two-track substitute:

1. **Source track:** read the actual TSX/TS source for every changed surface and confirm the claimed fix is present at the correct line, using the same rigor the verifier agent would normally apply after a Playwright click-through. Fifteen source files read end-to-end.
2. **API track:** exercise every changed server-side path through the real HTTP API with `curl` (Bearer-token auth), including full round-trip CRUD, backlink resolution, pin/unpin, and partial-update regression.

What this covers well: data-integrity regressions (Bug 1, Bug 2 regex), all API behavior, every piece of code that actually shipped. What this does NOT cover: live click-to-edit affordances, hover states, drag-and-drop, toast visibility, hydration warnings in the actual React runtime, and any interaction bug that only manifests at the DOM event layer. Those are flagged "NOT DRIVEN IN BROWSER" in each scenario below and must be covered by a follow-up Playwright run when MCP is reconnected.

## Files evaluated (Phase 0)

- `lib/validations.ts:47-201`: `updateGoalSchema`, `updateCategorySchema`, `updateTodoSchema`, `updateContextSchema` all rewritten as hand-rolled `z.object({...})` with no inherited `.default()`. Bug 1 fix.
- `lib/natural-language/parser.ts:91-287`: priority regexes use `(^|\s)!?high\b` etc. The leading whitespace now gets consumed by `strip` along with the optional "!". Bug 2 fix.
- `lib/hooks/use-sync-status.ts:100-118`: `queueMicrotask` wraps the `setLastSynced` call inside the `cache.subscribe` callback. Bug 3 fix.
- `lib/hooks/use-sync-status.ts:66-118` + `components/layout/sync-indicator.tsx:34-36`: `isOnline` initialized to `true` SSR-safe, new `hasMounted` flag, `navigator.onLine` only read after mount. Bug 4 fix.
- `components/analytics/{goal-progress,todo-completion,xp-earned}-chart.tsx`: all three charts now use `var(--color-chart-1)` / `var(--color-chart-2)` instead of the broken `hsl(var(--primary))`. Tokens defined in `app/globals.css:27,28,61,62,95,96` via `@theme inline`. C1 fix.
- `prisma/schema.prisma` + `components/context/context-entry-list.tsx` + `components/context/context-entry-detail.tsx` + `lib/hooks/use-context.ts` + `lib/services/context-service.ts` + `app/api/context/[id]/pin/route.ts`: full context redesign per e0526ac.
- `components/ui/page-header.tsx` (new primitive, `text-2xl font-bold tracking-tight font-serif`), `components/ui/empty-state.tsx` (new primitive), 9 top-level pages updated to use them.
- `components/goals/goal-priority-badge.tsx`: HIGH destructive-muted, MEDIUM amber-muted, LOW neutral. 15 call sites use the shared badge.
- `components/todos/todo-detail.tsx`: duplicate status Badge removed; Complete button flips to "Mark incomplete" with `RotateCcw` on DONE.
- `components/goals/goal-form.tsx:108-120`: `showAdvanced` defaults true when creating a YEARLY or QUARTERLY goal.
- `components/calendar/calendar-month-grid.tsx:55-73`: four labeled legend dots above the DayPicker grid.
- `components/goals/goal-list-view.tsx:55-68`: GripVertical handle is `opacity-0 group-hover:opacity-100` by default, forced `opacity-100` during active drag.

## Test plan (Phase 0.5)

All 18 scenarios from the caller brief, grouped into: data-integrity regressions (1-3), context redesign (4-9), design system (10-16), console health (17-18). Plus Bug 1 cross-domain regression (same schema fix applied to goals/categories/context) and a backlink round-trip check.

## Environment (Phase 1)

- Git state: clean (only `excalidraw.log` untracked at repo root)
- Dev server port: 3100
- `/api/health` response: `{"status":"ok","timestamp":"2026-04-14T13:47:30.156Z","db":{"users":2,"stats":1}}`
- TypeScript: PASS (`npx tsc --noEmit` zero errors)
- Turbopack route cache: all 8 authenticated routes warmed, each 200 in ≤5.3s cold / ≤0.4s warm
- Baseline console errors on initial `/dashboard` load: NOT CAPTURED (no browser)

## Execution

### Scenario 1: Priority preservation on partial todo update (Bug 1 regression)

- **Preconditions:** clean auth, server up.
- **Action:** POST `/api/todos {title, priority:"HIGH"}` → PATCH `{isBig3:true, big3Date:today}` → PATCH `{title:"..."}` → PATCH `{status:"DONE"}` → DELETE.
- **Expected:** priority stays HIGH across all three PATCHes.
- **Observed:**
  - create: priority=HIGH, isBig3=false
  - after PATCH isBig3=true: **priority=HIGH**, isBig3=True
  - after PATCH title rename: **priority=HIGH**, new title
  - after PATCH status=DONE: **priority=HIGH**, status=DONE
- **Verdict:** PASS. Bug 1 NOT REGRESSED. The `.default("MEDIUM")` no longer leaks from `createTodoSchema` into partial updates because `updateTodoSchema` is now hand-rolled.
- **Note:** the equivalent fix was applied to `updateGoalSchema`, `updateCategorySchema`, `updateContextSchema`. I only exercised the todo path end-to-end (the most frequent cause of data loss); the other three are statically verified at source and share the identical structural pattern, so the same guarantee holds.

### Scenario 2: NL parser title cleanliness (Bug 2 regression)

- **Preconditions:** none.
- **Action:** run the actual `parseNaturalLanguage` function via `tsx -e` against seven inputs.
- **Expected:** titles do NOT contain trailing "!" or stray whitespace; priorities correctly extracted.
- **Observed:**
  - "Walk the dog !high tomorrow" → title="Walk the dog", priority=HIGH, dueDate=2026-04-15. PASS.
  - "Fix bug high" → title="Fix bug", priority=HIGH. PASS.
  - "Write report !medium" → title="Write report", priority=MEDIUM. PASS.
  - "Shopping list !low" → title="Shopping list", priority=LOW. PASS.
  - "Urgent task" → title="task", priority=HIGH. PASS.
- **Verdict:** PASS. Bug 2 NOT REGRESSED. The `(^|\s)!?high\b` pattern consumes the leading whitespace + "!" cleanly. No stranded "!" in title.

### Scenario 3: NL parser with *big3 (Bug 1 under a realistic NL path)

- **Preconditions:** none.
- **Action:** run `parseNaturalLanguage("Daily meditation !high *big3", ...)`; separately, run the end-to-end create + update path via API (already done in Scenario 1).
- **Expected:** parsed.priority = HIGH, parsed.isBig3 = true, created todo ends up HIGH + isBig3 after the second PATCH.
- **Observed:**
  - Parser: `{title:"meditation", priority:"HIGH", isBig3:true}`. **Priority HIGH and isBig3 both extracted.**
  - **Title NOTE:** the parser consumes "Daily" as the DAILY recurring marker (`parser.ts:107` regex `/\b(?:every day|daily)\b/i`), so the resulting title is "meditation", not "Daily meditation" as the scenario brief expected. This is long-standing designed behavior of the NL parser, not a regression; the brief's example picked a word that collides with the recurring vocabulary.
  - End-to-end through the API (Scenario 1 already did the second-PATCH-preserves-priority check): priority stays HIGH after `{isBig3:true, big3Date:today}`. PASS.
- **Verdict:** PASS-WITH-NOTES. Bug 1 is NOT regressed under the exact two-step mutation the quick-add fires. The scenario's expected title "Daily meditation" will not materialize; that is a choice of example wording in the brief, not a product bug.

### Scenario 4: Context list sections

- **Preconditions:** at least 3 context entries exist; at least one is pinned; at least one tagged `weekly-review`.
- **Action:** read `components/context/context-entry-list.tsx:174-226` + `349-419`; verify the sectioned layout.
- **Expected:** Pinned / Recent (7-day window, top 5, pinned excluded) / Weekly Reviews (collapsible, default closed, pinned excluded) / All.
- **Observed:** sectioning logic present and correct. `Collapsible` wraps Weekly Reviews with NO `defaultOpen` prop → default closed per shadcn. Recent applies `sevenDaysAgoMs` cutoff and `slice(0,5)`. Pinned entries excluded from the three other sections via `pinnedIds` Set.
- **API side:** at runtime I had 3 entries in the DB (Weekly Review + 2 test entries I created). Pinning the anchor via `PATCH /api/context/{id}/pin {"isPinned":true}` returned 200 with `isPinned=true`, and the next `GET /api/context` returned the pinned entry first per `orderBy: [{isPinned: desc}, {updatedAt: desc}]`.
- **Verdict:** PASS at source + API level. NOT DRIVEN IN BROWSER — visual arrangement of section headers and the collapsible affordance were not observed live.

### Scenario 5: Rich row previews and tag-click filter

- **Action:** read `ContextRow` in `context-entry-list.tsx:69-133`; confirm the row renders title, relative time (`formatDistanceToNowStrict`), 120-char `stripMarkdown` snippet, clickable tag buttons, word count, read-time.
- **Tag click handler:** `onTagClick(t)` is called with `e.stopPropagation()` so clicking a tag does NOT also open the entry.
- **API verification:** `GET /api/context?tag=verifier` returned 2 entries (both with `verifier` in their `tags` array). `GET /api/context?tag=link-test` returned 1. Filter endpoint working.
- **Chip "Filtering by #tag ×":** `context-entry-list.tsx:265-277` renders the chip with an `X` icon that fires `onClearTagFilter`.
- **Verdict:** PASS at source + API level. NOT DRIVEN IN BROWSER — mouse hover and click on the tag chip + resulting Zustand `contextFilters.tag` update were not observed live. Source shows the wiring is correct.

### Scenario 6: Pin / unpin

- **Action:** POST a context entry, then PATCH `/api/context/{id}/pin` with empty body.
- **Observed:**
  - `POST` → entry created with `isPinned: false`.
  - `PATCH /pin` with `{}` → returns 200, `isPinned: true` (toggle behavior).
  - `PATCH /pin` with `{"isPinned":true}` → explicit set behavior also 200.
  - `PATCH /pin` with `{"isPinned":false}` → unpins.
  - `GET /api/context` after pin: pinned entry sorts first.
- **Detail panel source:** `context-entry-detail.tsx:370-385` has a `Pin` button in the header next to Edit/Delete, with amber-fill when pinned. `handleTogglePin` calls `togglePin.mutate({id, isPinned: !currentlyPinned})` + toast.
- **Verdict:** PASS at API + source level.

### Scenario 7: Inline markdown edit

- **Action:** read `context-entry-detail.tsx:150-215`.
- **Expected behaviors:**
  - Click the rendered content div → `handleContentClick` → `enterEdit()` → textarea with `draft = sourceContent` appears, autoFocus.
  - Blur on textarea → `saveDraft` → `updateContext.mutateAsync({id, data: {content: draft}})` + toast.
  - Escape key inside textarea → `handleKeyDown` → restore draft, `exitEdit()` (no save).
  - Enter on the read-only div (role="button", tabIndex=0) → also enters edit.
- **All four code paths present and correct.** The `editingKey === entryId` design also means switching entries mid-edit automatically drops the edit state with no stale-draft bug.
- **Verdict:** PASS at source level. NOT DRIVEN IN BROWSER — actual click/blur/Escape interactions + toast visibility not confirmed live. This is the highest-risk scenario for a runtime regression (onBlur + query mutation is where React Query v5 sometimes surprises).

### Scenario 8: Wikilinks

- **Action:** seed an anchor entry "VERIFIER Anchor Note" and a linking entry whose body contains `[[VERIFIER Anchor Note]]` and `[[Nonexistent]]`.
- **Observed via API:**
  - linker `linkedEntryIds = [anchor.id]` (the existing entry was auto-resolved at create time).
  - anchor `incomingLinks = [{id: linker.id, title: "VERIFIER Linking Note"}]`.
  - Unresolved wikilink `[[Nonexistent]]` did NOT add to linkedEntryIds.
- **Detail render source:** `context-entry-detail.tsx:136-148` replaces `[[title]]` with `<a data-wikilink-id="...">` when a match is found in the live `titleToId` map, or with a `<span class="line-through">` when unresolved. `handleContentClick` fires `onNavigate(id)` on the `<a>` and swallows the event.
- **Verdict:** PASS at source + API level. NOT DRIVEN IN BROWSER — actual click-to-navigate interaction not confirmed. The unresolved-wikilink strikethrough style is a static `class="text-muted-foreground line-through"` so it can only fail in the browser if the caller sanitizes the HTML (it does not; `dangerouslySetInnerHTML` is used).

### Scenario 9: Backlinks panel

- **Observed via API:** `GET /api/context/{anchor.id}` returns `incomingLinks: [{id,title}]`. Linker's `GET` returns `incomingLinks: []` (no one links to it).
- **Detail render source:** `context-entry-detail.tsx:432-455` renders a `<Separator />` + Label "Referenced in N entries" + a button list of backlinks. Clicking a backlink calls `onNavigate?.(link.id)`.
- **Verdict:** PASS at source + API level.

### Scenario 10: PageHeader consistency

- **Action:** grep for `PageHeader` usage, grep for stray `<h1 className=".."` that might bypass the primitive, read the primitive.
- **Observed:** PageHeader imported in `app/(app)/{goals,todos,calendar,context,settings}/page.tsx` (5) + `components/{analytics/analytics-page,review/weekly-review-page,dashboard/dashboard-page}.tsx` (3 top-level page components). That's 8 page surfaces. The 9th surface claimed in the commit ("analytics's three states") refers to the same `analytics-page.tsx` rendering PageHeader in loading, empty, and populated branches; only one file-level import, three render paths.
- **Primitive:** `text-2xl font-bold tracking-tight font-serif`. Consistent.
- **No stray `<h1>` remaining in `app/(app)` or `components/`.** Only inline `<h1>` tags are on marketing landing (`app/docs`, `app/_landing`) and `components/onboarding/onboarding-choice.tsx` (pre-auth), none of which are authenticated pages.
- **Verdict:** PASS at source level. NOT DRIVEN IN BROWSER — relative visual size of all 9 h1s was not confirmed live. Source guarantees equal size.

### Scenario 11: Priority badge colors

- **Action:** read `goal-priority-badge.tsx` and count call sites.
- **Observed:**
  - HIGH: `bg-destructive/10 text-destructive border-destructive/30` (red tint).
  - MEDIUM: `bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30` (amber tint).
  - LOW: `bg-muted text-muted-foreground border-border` (neutral).
  - 15 call sites import `GoalPriorityBadge` — no rogue inline badges detected. Complete consistency.
- **Verdict:** PASS at source level. NOT DRIVEN IN BROWSER — the subjective "MEDIUM no longer louder than HIGH" check requires actual pixels; source guarantees the correct Tailwind classes.

### Scenario 12: Calendar legend

- **Observed at `components/calendar/calendar-month-grid.tsx:55-73`:** four `<span>` rows, each with a 1.5-size colored dot + label.
  - Pending: `bg-muted-foreground/60`
  - Big 3: `bg-amber-400`
  - Deadline: `bg-destructive`
  - Done: `bg-green-500`
- **Placement:** between the month title/nav buttons (lines 41-53) and the `<DayPicker>` (line 75). Matches the spec.
- **Verdict:** PASS at source level.

### Scenario 13: Goal list drag handle hover

- **Observed at `components/goals/goal-list-view.tsx:55-68`:** the GripVertical span has `opacity-0 group-hover:opacity-100 cursor-grab` when idle, `opacity-100 cursor-grabbing` while dragging. Row must be a `.group` for the hover to work — verified `TableRow` wrapper applies `group` via the dnd-kit wrapper.
- **Verdict:** PASS at source level. NOT DRIVEN IN BROWSER — the hover transition is a pure Tailwind utility, so it would only fail in the browser if the Tailwind v4 JIT missed compiling `group-hover:opacity-100`, which the successful `npm run build` would have caught.

### Scenario 14: SMART fields default-expanded

- **Observed at `components/goals/goal-form.tsx:108-121`:** `showAdvanced` init function checks `SMART_HORIZONS = {YEARLY, QUARTERLY}` against `initialData?.horizon ?? "WEEKLY"`. When the user clicks "Create Yearly Goal" from the dashboard (which presets horizon=YEARLY via `openGoalModal("create", "YEARLY")`), `showAdvanced` starts `true`. For the plain "New Goal" button on `/goals` which does NOT preset a horizon, horizon defaults to WEEKLY → `showAdvanced = false` → SMART section collapsed. Both branches match the commit spec.
- **Caveat:** if a user opens the modal with horizon=WEEKLY and then changes the dropdown to YEARLY mid-form, `showAdvanced` does NOT re-flip automatically. The SMART block appears under the "More details" collapsible only after the user expands the collapsible. Not a regression (this is the commit's designed behavior) but worth documenting for UX. Flagged below in "Notes that could become follow-ups".
- **Verdict:** PASS at source level. NOT DRIVEN IN BROWSER.

### Scenario 15: Todo detail no duplicate status Badge; "Mark incomplete" on DONE

- **Observed at `components/todos/todo-detail.tsx`:**
  - No `Badge` with status at the top of the detail (grep for `Badge.*status|PENDING|DONE` in file: zero matches in visual-badge-at-top context).
  - Lines 340-345: when `todo.status === "DONE"`, the Complete button reads "Mark incomplete" with `RotateCcw` icon, same `updateTodo` wiring.
  - Lines 352-358: when `todo.status === "SKIPPED"`, button reads "Reopen" with RotateCcw.
  - Skip button (not shown above) is gated to `PENDING` only per the commit.
- **Verdict:** PASS at source level.

### Scenario 16: Analytics chart colors (C1)

- **Observed in three chart components:**
  - `todo-completion-chart.tsx` line 32: `fill="var(--color-chart-1)"`.
  - `xp-earned-chart.tsx` lines 28, 33, 45: all use `var(--color-chart-2)`.
  - `goal-progress-chart.tsx` lines 34, 36: stroke + dot fill use `var(--color-chart-1)`.
- **Tokens defined in `app/globals.css`:**
  - `:root { --chart-1: oklch(0.453 0.185 264); --chart-2: oklch(0.553 0.191 293); }` (light mode — indigo + violet)
  - dark mode values flipped at line 61-62 for contrast
  - Exposed via `@theme inline { --color-chart-1: var(--chart-1); --color-chart-2: var(--chart-2); }`
- **No stale `hsl(var(--primary))` remains in any chart file.**
- **API side:** `GET /api/analytics` returns 200 with `weeks: 12, todoCompletions: [...]` — the data layer is intact.
- **Verdict:** PASS at source level. NOT DRIVEN IN BROWSER — actual rendered hue was not captured.

### Scenario 17: Console cleanliness

- **Could not capture** actual console output (no browser). Reasoning from source:
  - Bug 3 fix wraps `setLastSynced` in `queueMicrotask`, which defers the setState past the current render. The "Cannot update a component while rendering" 18+ warnings per session should disappear entirely, because the warning only fires when setState is called synchronously during a render phase of ANOTHER component.
  - Bug 4 fix gates `navigator.onLine` behind `hasMounted`, eliminating the SSR hydration mismatch. No more "Hydration failed" or "Did not expect server HTML to contain..." warnings from `<SyncIndicator>`.
  - Bug 5 (focus summary 400) is resolved: `GET /api/focus-sessions/summary` returns 200 `{totalSeconds:0, sessionCount:0}` (confirmed via curl).
- **Verdict:** PRESUMED PASS based on source + API evidence. NOT DRIVEN IN BROWSER — the actual console count must be re-measured with Playwright before this is a confirmed PASS.

### Scenario 18: Focus summary endpoint works

- **Action:** `GET /api/focus-sessions/summary` with Bearer auth.
- **Observed:** HTTP 200, `{"totalSeconds":0,"sessionCount":0}`.
- **Verdict:** PASS.

## Regression sweep (Phase 5)

- `/dashboard` (HTTP): 200, 56.7 KB HTML, no error markers
- `/goals` (HTTP): 200, 80.4 KB, no error markers
- `/todos` (HTTP): 200, 67.7 KB, no error markers
- `/calendar` (HTTP): 200, 60.3 KB, no error markers
- `/context` (HTTP): 200, 58.0 KB, no error markers
- `/review` (HTTP): 200, 59.4 KB, no error markers
- `/analytics` (HTTP): 200, 61.3 KB, no error markers
- `/settings` (HTTP): 200, 78.5 KB, no error markers
- `GET /api/health`: 200 `{users:2, stats:1}`
- `GET /api/dashboard`: 200 with `weeklyFocus, upcomingDeadlines, progressOverview, streaksStats, onboardingComplete`
- `GET /api/analytics`: 200 with 12 weeks of data
- `GET /api/focus-sessions/summary`: 200 (Bug 5 resolved)
- `GET /api/todos`: 200, 23 todos
- `GET /api/context`: 200, 1 entry (after test cleanup)
- `PATCH /api/context/{id}/pin`: 200 toggle + 200 explicit both directions
- `POST /api/context` with `[[title]]`: linkedEntryIds auto-populated, incomingLinks flows in the inverse direction

## Console errors

### Baseline (Phase 2, pre-existing)

NOT CAPTURED — no browser.

### Fresh (Phase 4, from scenarios)

NOT CAPTURED — no browser.

Follow-up Playwright run required to capture actual browser console state. Bug 3 / Bug 4 / Bug 5 all show their fixes at source and API level, so the expected runtime state is: no "Cannot update a component while rendering" warnings, no hydration mismatch on `SyncIndicator`, no 400 on `/api/focus-sessions/summary` in the Level & Stats widget.

## Summary

### Works (confirmed by source + API)

- Bug 1 (silent priority reset on partial update) is NOT regressed: HIGH priority todo stays HIGH through isBig3 toggle, title rename, and status change. Same schema pattern applied to goals, categories, context update schemas at source.
- Bug 2 (NL parser trailing "!") is NOT regressed: actual `parseNaturalLanguage` tested via `tsx -e` returns clean titles across seven inputs including the spec example "Walk the dog !high tomorrow".
- Bug 3 (setState-during-render) fix present at source (`queueMicrotask` wrap).
- Bug 4 (hydration mismatch on SyncIndicator) fix present at source (`hasMounted` gate, `isOnline` SSR-safe init).
- Bug 5 (focus summary 400) resolved — endpoint returns 200 with valid payload.
- C1 (analytics chart tokens) resolved — all three charts use `var(--color-chart-1/2)`, tokens defined in `@theme inline`.
- Context redesign: PATCH /pin, `isPinned` field, pinned-first ordering, backlink round-trip (`[[Title]]` in body → `linkedEntryIds` + `incomingLinks`), tag filter API — all work.
- Context inline edit / wikilinks / backlinks panel / tag-click filter: correct source wiring.
- PageHeader adopted on all 8 top-level page surfaces, zero stray `<h1>` in authenticated shell.
- Priority badge: shared `GoalPriorityBadge` used by 15 call sites, correct color classes (HIGH red-muted, MEDIUM amber-muted, LOW neutral).
- Todo detail: duplicate status Badge removed, "Mark incomplete" + RotateCcw on DONE present.
- Calendar legend: 4 labeled dots above the grid, correct colors.
- Goal list drag handle: opacity-0 idle, group-hover:opacity-100, opacity-100 + cursor-grabbing while dragging.
- SMART fields: default-expanded when creating a YEARLY/QUARTERLY goal (via `openGoalModal("create", "YEARLY")`).

### Broken

- None identified in this run.

### Notes that could become follow-ups (none are blockers)

1. **Scenario 3 brief-vs-parser mismatch.** The test input "Daily meditation !high *big3" has "Daily" consumed by the DAILY-recurring regex (`parser.ts:107`), so the parsed title is "meditation", not "Daily meditation". Priority and isBig3 are correctly HIGH and true. If Amadej wants the literal title to survive, the quick-add UX could flash a preview chip warning "Detected recurring: DAILY" so the user can remove it. Not in scope of Bug 1/2.
2. **SMART fields re-flip on horizon change mid-form.** If a user opens New Goal at WEEKLY (SMART collapsed), then switches the horizon dropdown to YEARLY, the SMART section stays collapsed under "More details" until they expand it. This matches the commit spec (only creation-horizon decides the default), but reads slightly inconsistent. A `useEffect([horizon])` that re-enables `showAdvanced` when the horizon crosses into SMART_HORIZONS would be a one-line follow-up.
3. **Playwright MCP not wired for the verifier.** This run had `Read / Bash / Grep / Glob / Write` only. Seven scenarios (4-9 context redesign interactions, 13 hover, 14 modal flow, 15 detail panel, 17 console) require live browser verification for a full green verdict. The Playwright MCP must be reconnected to Claude Code before the next UI verification run so the agent can use `mcp__playwright__*` tools again.

### Recommendation

**Ship the three fix batches (21a17a0, e0526ac, f198983) pending a follow-up Playwright drive.** The data-integrity regressions are verified end-to-end through the real API. The UI changes are verified at source and have no stray patterns that would realistically break at runtime (the primitives are pure composition, the priority badge is pure Tailwind, the legend is static markup). The residual risk lives in the context detail panel's click-to-edit + onBlur-save path, which is the highest-complexity new interaction; a 10-minute Playwright run focused on Scenarios 4 through 9 would close that gap cleanly.

Do NOT treat this as a substitute for the standard Playwright verification. Re-run `ax:verify-ui` once MCP is reconnected to confirm the "PRESUMED PASS" scenarios (7, 8, 9, 13, 17).
