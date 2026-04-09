# Domain Pitfalls: Adding To-Dos, Calendar View, and Context System

**Domain:** Extending an existing goal tracking app (Ascend) with to-dos, calendar, and context features
**Researched:** 2026-04-08
**Overall confidence:** HIGH (verified against existing codebase, competitor analysis, and community patterns)
**Scope:** Subsequent milestone adding to-dos (inputs), calendar view, context system to an app that already has goals, categories, gamification, recurring goals, drag-and-drop, MCP server, PWA, and onboarding.

## Critical Pitfalls

Mistakes that cause rewrites, fundamental confusion, or systemic breakage.

### Pitfall 1: Blurring the Boundary Between To-Dos and Goals

**What goes wrong:** Developer adds a `Todo` entity that overlaps with the existing `Goal` model. Users cannot tell when to create a to-do versus a weekly goal. Both have titles, deadlines, statuses, and categories. The app ends up with two parallel systems for tracking "things to do," each with its own completion logic, filtering, views, and MCP tools. Feature parity between the two diverges over time, creating confusion about which entity to use.

**Why it happens:** The existing `Goal` model already covers tasks at the weekly horizon. Weekly goals have statuses, priorities, deadlines, categories, and streak tracking. A "to-do" in the productivity domain is functionally identical to a weekly goal with a deadline. The impulse to add a separate entity comes from perceiving to-dos as "smaller" or "quicker" than goals, but this distinction is subjective and impossible to enforce in a schema. Todoist and TickTick both treat everything as tasks; the hierarchy provides the semantic distinction between "goal" and "task."

**Consequences:** Two query paths for the dashboard ("upcoming goals" and "upcoming to-dos" that return nearly identical data). Two sets of MCP tools (existing 22 tools plus new to-do tools, pushing past the LLM confusion threshold documented in Pitfall 10 of the original research). The gamification system must decide whether to-do completions award XP (if yes, they duplicate goal XP; if no, users feel penalized for using to-dos). Calendar view must display both entities, doubling the rendering logic. Filtering becomes a combinatorial explosion of entity type plus status plus priority plus category.

**Warning signs:**
- A `Todo` Prisma model that duplicates more than 3 fields from `Goal`
- API routes for `/api/todos` that mirror `/api/goals` with minor differences
- MCP tool definitions that say "like goals, but for quick tasks"
- Dashboard widget showing "To-Dos" separately from "Weekly Focus" with identical data shape

**Prevention:** Do NOT create a separate `Todo` model. Instead, extend the existing `Goal` model with a lightweight "quick task" mode. Concretely:

1. **Add an `isQuickTask` boolean** (default false) to the `Goal` model. Quick tasks are goals with `horizon: WEEKLY`, no SMART fields, no hierarchy expectations, and simplified creation (title + optional deadline + optional category).
2. **The "To-Do" view is a filtered goal view** with `isQuickTask: true` or `horizon: WEEKLY`, showing a streamlined card without SMART fields or hierarchy breadcrumbs.
3. **Quick-add already exists** (`QuickAdd` component). Extend it to default `isQuickTask: true` for rapid entry while "New Goal" opens the full form.
4. **Gamification treats them identically** because weekly goals already award base XP (50 * priority multiplier). No separate XP track needed.
5. **MCP tools stay the same:** `create_goal` with `isQuickTask: true` covers to-do creation without new tools.

The semantic distinction between "to-do" and "goal" is a UI concern (presentation, form complexity, default filters), not a data model concern.

**Phase:** Data model design. This must be resolved before any UI work begins.

**Confidence:** HIGH (based on competitor analysis: Todoist, TickTick, Things 3 all use a single task entity with hierarchy for semantic distinction; validated against the existing Ascend Goal schema which already covers the to-do use case)

---

### Pitfall 2: Recurring To-Dos Creating a Parallel Habit System

**What goes wrong:** After adding to-dos, the developer realizes users want recurring to-dos ("Take vitamins daily," "Weekly review"). This duplicates the existing recurring goal infrastructure (templates with `recurringSourceId`, streak tracking on the template, lazy instance generation in `recurring-service.ts`). Now there are two recurrence systems, two streak trackers, and two generation pipelines.

**Why it happens:** The existing `recurringService` is tightly coupled to the `Goal` entity. Its `generateDueInstances()` method queries goals with `isRecurring: true` and `recurringSourceId: null`. If to-dos are a separate entity, recurring to-dos need a parallel system. Even if to-dos ARE goals (per Pitfall 1's prevention), the temptation is to build a "simpler" recurrence for quick tasks that skips SMART fields and hierarchy validation.

**Consequences:** Two streak counters (one on the goal template via `currentStreak`/`longestStreak`, one on the to-do). Dashboard streaks widget shows goal streaks but not to-do streaks, or vice versa. The Smashing Magazine 2026 article on streak psychology warns that inconsistent streak visibility "teaches users that their effort doesn't count equally across the app." The gamification service awards XP for recurring goal completion but misses recurring to-do completion.

**Warning signs:**
- A `RecurringTodo` model or a `todoRecurringService.ts` file
- Streak tracking fields duplicated on a new entity
- Dashboard `activeStreaks` count ignoring one entity type
- Different grace periods for goal streaks versus to-do streaks

**Prevention:** If to-dos are implemented as `Goal` records (Pitfall 1's recommendation), recurring to-dos are just recurring goals. The existing `recurringService` handles them identically. No new recurrence logic is needed. The `isQuickTask` flag only affects UI presentation (simpler form, no SMART fields), not the recurrence or streak mechanics.

If the team decides on a separate `Todo` entity despite the recommendation, the recurring infrastructure MUST use a shared abstraction (a `RecurrableItem` interface with `frequencyField`, `intervalField`, `lastCompleted`, `currentStreak`, `longestStreak`) that both entities implement, with a single generation pipeline.

**Phase:** Data model design, immediately after resolving Pitfall 1.

**Confidence:** HIGH (verified against existing `recurring-service.ts` code which already handles all the mechanics needed)

---

### Pitfall 3: Calendar View Rendering Every Goal and To-Do for Every Day

**What goes wrong:** The calendar view renders a month grid where every cell queries or filters all goals/to-dos for that date. With 200+ goals across the hierarchy and recurring instances generating new items weekly, the calendar becomes a performance nightmare. Each day cell renders multiple overlapping items, requiring height calculations, overflow handling, and "+N more" truncation. Month navigation triggers a full re-render and re-fetch, causing visible flicker.

**Why it happens:** The naive approach treats the calendar as a visual container for the entire goal dataset, filtered by date range. But unlike a dedicated calendar app where events have precise start/end times, goal deadlines cluster on specific days (Mondays for weekly goals, month-ends for monthly goals, quarter-ends for quarterly). This clustering means some cells have 15+ items while most have zero, making uniform cell height impossible without severe truncation.

**Consequences:** Month navigation feels sluggish (re-fetching 200+ goals, re-computing which belong to which day). Day cells with many deadlines overflow visually or hide important items behind "+5 more." Recurring goal instances clutter every matching day (daily recurring goals show on all 30 cells). Mobile calendar is unusable because cells are too small for any meaningful content.

**Warning signs:**
- Calendar fetch endpoint returning the entire goals list instead of a date-bounded subset
- Day cells with variable heights causing the grid to shift during scroll
- "Loading..." flash on every month navigation
- Recurring daily goals appearing as 30 items in the month view

**Prevention:**

1. **Fetch only the visible range.** Create a dedicated endpoint or service method: `goalService.listByDateRange(userId, startDate, endDate)` that queries goals with `deadline BETWEEN start AND end`. Include recurring goal instances in the range, but NOT recurring templates (templates have no deadline; only instances do).

2. **Aggregate recurring goals in month view.** Instead of showing 30 individual daily recurring instances, show one "streak indicator" per recurring template on the calendar. The visual is a small dot or colored bar on days where an instance exists, not a full goal card per day.

3. **Two-tier calendar design.** Month view shows only deadline indicators (dots, counts, priority-colored markers). Clicking a day opens a day detail panel (or navigates to a day view) showing the full goal list for that date. This avoids rendering full goal cards in tiny cells.

4. **Prefetch adjacent months.** When the user is on April, prefetch March and May in the background. This makes month navigation feel instant. Use React Query's `prefetchQuery` with the date range keys.

5. **Memoize day cell rendering.** Each day cell should be a `React.memo` component keyed by the date string and a hash of the goals for that date. Month navigation should NOT cause cells with identical content to re-render.

6. **Existing `useGoals` hook already supports filters.** Extend it with a `dateRange: { start: Date, end: Date }` filter rather than creating a separate calendar data hook.

**Phase:** Calendar view implementation. The fetch optimization must come before the UI.

**Confidence:** HIGH (verified against React calendar performance patterns from Builder.io and React Native Calendars optimization guides; Todoist's weak calendar implementation provides a cautionary example)

---

### Pitfall 4: Context System Scope Creep Into a Second Brain

**What goes wrong:** The "context system" starts as a simple way to attach notes and reference material to goals (meeting agendas, links, decision logs) but gradually expands into a full knowledge management system with folders, tags, full-text search, rich text editing, and bidirectional linking. Development slows because the context system becomes its own product within the product. The original research's anti-features list explicitly flags this: "Note-taking / knowledge management" is an anti-feature because "Notion, Obsidian, and Apple Notes are better note tools. Bundling notes into a goal tracker creates a bloated 'second brain' that does nothing well."

**Why it happens:** "Context" is vague. Without a strict definition, every piece of supporting information feels like it belongs in the context system: meeting notes, web bookmarks, file attachments, decision logs, reference documents, journal entries, daily reflections. The developer keeps adding entity types and relationships because each one "makes sense" individually. The result is a sprawling knowledge graph that no one uses because the goal tracking app is not where people manage knowledge.

**Consequences:** Schema bloat (new models for `Note`, `Document`, `Link`, `Attachment`, `Tag`, potentially `Folder`). The Prisma schema grows from 6 models to 12+. Every new context entity needs CRUD routes, MCP tools, UI components, and search integration. The MCP server, which already has 22 tools, gains another 10+ for context management, pushing well past the LLM confusion threshold. The calendar view must now show "context events" alongside goal deadlines, further complicating rendering.

**Warning signs:**
- More than 2 new Prisma models for the context system
- A rich text editor dependency (Tiptap, Plate, etc.) being added
- MCP tools for "create_note," "search_notes," "link_note_to_goal"
- A "Context" section in the sidebar that rivals the "Goals" section in complexity
- Users opening the app to take notes instead of track goals

**Prevention:** Define context as a **single field extension on the Goal model**, not a separate entity system. Concretely:

1. **Extend Goal with a `context` JSONB field** (or a simple `context: String?` for markdown text). This holds any supporting information: links, notes, decisions, references. No separate model needed.
2. **The UI shows context as a collapsible section in the goal detail panel,** not as a separate page or view. It is subordinate to the goal, not a peer entity.
3. **No separate search for context.** Context is searchable through goal search (include the context field in the full-text search query).
4. **No MCP tools for context management.** The existing `update_goal` tool handles setting/updating the context field. "Add context to goal X" is just `update_goal({ id: X, context: "..." })`.
5. **Maximum scope for v1:** A markdown text field on goals, rendered with basic markdown formatting in the detail panel. If richer structure is needed later, evolve the JSONB field to store structured data (array of `{ type: 'link' | 'note' | 'decision', content: string, createdAt: Date }`).

The key discipline is: context serves goals. It does not exist independently.

**Phase:** Data model design. Must be scoped tightly before any implementation.

**Confidence:** HIGH (the original FEATURES.md explicitly lists knowledge management as an anti-feature; competitor analysis shows Notion's "everything tool" approach is the #1 user complaint about setup complexity)

---

### Pitfall 5: Removing Cards/Board Views Breaking Persisted User State

**What goes wrong:** The milestone calls for "view simplification (removing cards/board views)." The existing `ui-store.ts` persists `activeView` to localStorage with value `"cards"` or `"board"` (though "board" was already migrated to "cards" in a prior version). If these view types are removed from the `ViewType` union but existing users have `"cards"` persisted in their localStorage, the app crashes on load or defaults to an undefined view state. The view switcher renders with stale icons/labels. Keyboard shortcuts for removed views still trigger.

**Why it happens:** The Zustand store uses `persist` middleware with `name: "ascend-ui"` and `version: 5`. The migration logic handles version < 4 and version 4 transitions but does not anticipate removing view types in future versions. The `VIEW_OPTIONS` array in `goal-view-switcher.tsx` drives the UI, but the persisted state drives the initial render. If the persisted `activeView` value no longer exists in the options, the app shows no content.

**Consequences:** Blank goals page on first load after the update. Users must manually clear localStorage to recover. The bug is silent (no error toast, no fallback) because the rendering logic in `goals/page.tsx` has an `if (activeView === "cards")` branch that returns content, and if `activeView` is an invalid value, no branch matches and nothing renders.

**Warning signs:**
- The `ViewType` type union being narrowed without updating `persist` version
- Missing `migrate` function for the new persist version
- Tests passing because they start with fresh state (no persisted localStorage)
- "It works in dev but not in production" bug reports

**Prevention:**

1. **Increment the Zustand persist version** (from 5 to 6) and add a migration function that maps removed view types to valid ones. Example: `"cards" -> "list"`, `"board" -> "list"`.
2. **Update the `ViewType` union, `VIEW_OPTIONS` array, keyboard shortcuts, and `renderContent()` branches simultaneously** in a single commit. Do not remove the type before removing all references.
3. **Add a fallback in `renderContent()`** that handles unknown view types by defaulting to list view. This is defensive programming against future state corruption:
   ```typescript
   // Default fallback for any unknown or removed view type
   return <GoalListView goals={goalList} />;
   ```
4. **Update MCP tools** if any tool accepts a `view` parameter (check `data-tools.ts` for settings management).
5. **Test with pre-existing localStorage.** Before shipping, manually set `localStorage.setItem("ascend-ui", JSON.stringify({ state: { activeView: "cards" }, version: 5 }))` and verify the app loads correctly.

**Phase:** View simplification. This must be the first task, before adding calendar view, because changing the ViewType union affects everything.

**Confidence:** HIGH (verified by reading the actual `ui-store.ts` code, which has the exact persist/migrate pattern described)

## Moderate Pitfalls

### Pitfall 6: Timeline Width Pushing Detail Panel Off Viewport

**What goes wrong:** The timeline view renders a horizontally scrollable content area. When a goal is selected, the 400px/440px detail panel (hardcoded in `goals/page.tsx` as `w-[400px] lg:w-[440px]`) opens on the right. The timeline content area does not shrink to accommodate the panel because it uses horizontal scrolling internally. The detail panel is pushed off the right edge of the viewport, or the timeline and panel overlap, or horizontal scrolling no longer works because the available width calculation is wrong.

**Why it happens:** The current layout in `goals/page.tsx` uses a flex container with `flex-1` for the content area and a fixed width for the detail panel. This works for list, tree, and card views because they use vertical scrolling within the `flex-1` container. The timeline view is unique: it uses horizontal scrolling, which means its width is determined by its content, not by the container. When the detail panel appears, the `flex-1` container shrinks, but the timeline's internal scroll width does not recalculate, causing layout breakage.

**Consequences:** Timeline view becomes unusable when a goal is selected. Users see the detail panel overlapping timeline content or a horizontal scrollbar that scrolls the entire page. On smaller screens (1280px laptops), the timeline may have almost no visible width after the panel takes 440px.

**Warning signs:**
- Horizontal scrollbar appearing on the main page (not within the timeline container)
- Detail panel's close button being clipped off screen
- Timeline content jumping when the detail panel opens/closes
- `window.innerWidth` calculations in timeline code not accounting for the panel

**Prevention:**

1. **Use `overflow-x: auto` on the timeline container, NOT on the page.** The timeline's parent div must be the scroll container, sized by flex to fill available space. When the detail panel opens, the flex container shrinks and the timeline reflows within the smaller space.
2. **Listen for panel open/close in the timeline component.** Subscribe to `useUIStore.selectedGoalId` and recalculate the visible date range when the available width changes. Use `ResizeObserver` on the timeline container rather than `window.innerWidth`.
3. **Consider bottom/overlay panel for timeline view.** When `activeView === "timeline"`, show goal details in a bottom sheet or overlay instead of a side panel, preserving the full viewport width for horizontal content. This is how map applications handle detail panels over horizontally scrolled content.
4. **Set `min-width: 0` on the flex child** containing the timeline. Without this, flex children default to `min-width: auto` and will not shrink below their content width, causing overflow.

**Phase:** Calendar/view implementation phase. Address when modifying the view layout.

**Confidence:** HIGH (verified by reading the existing `goals/page.tsx` layout code, which uses the exact flex pattern described)

---

### Pitfall 7: Calendar Month Navigation State Conflicting with URL and Filter State

**What goes wrong:** The calendar view needs its own navigation state (current month, selected day). This state lives in three possible places: URL search params (via `nuqs`), Zustand UI store (like `timelineYear`/`timelineMonth`), and component local state. If month/day state is only in component state, navigating away and back resets to the current month. If it is in Zustand, it persists across sessions but conflicts with URL state that other views use for filtering. If it is in URL params, every month navigation changes the URL, creating unwanted browser history entries.

**Why it happens:** The existing app uses a hybrid approach: Zustand persists `activeView`, `activeFilters`, `timelineZoom`, `timelineYear`, `timelineMonth`. URL state (via nuqs) is not currently used for view-specific navigation. Adding calendar state to Zustand is consistent with the timeline approach, but the calendar needs both month-level navigation AND day-level selection, which is more granular than what the timeline tracks.

**Consequences:** Browser back button navigates between calendar months instead of between pages. Or the calendar always resets to the current month because state is not persisted. Or the URL shows `?calendarMonth=4&calendarYear=2026&selectedDay=8` which looks noisy and interacts unexpectedly with existing filter params. Deep linking breaks if calendar state is only in Zustand (sharing a URL does not include the viewed month).

**Warning signs:**
- Browser back button cycling through months instead of navigating to the previous page
- Calendar resetting to "today" every time the user switches views and comes back
- URL growing with calendar-specific query parameters
- Calendar month state conflicting with horizon filter tabs (which also imply time ranges)

**Prevention:**

1. **Store calendar month/year in Zustand** (add `calendarYear` and `calendarMonth` to `UIStore`, following the pattern already established for `timelineYear` and `timelineMonth`). Persist them via the existing `partialize` function. This ensures the calendar remembers where the user was across view switches.
2. **Store selected day in component local state** (NOT in Zustand or URL). Day selection is ephemeral: it shows a day detail, but navigating away should deselect. This prevents Zustand from persisting a stale selected day across sessions.
3. **Do NOT use URL params for calendar navigation.** Month navigation is frequent (12+ times per year view) and should not pollute browser history. The timeline already uses Zustand for this, and calendar should be consistent.
4. **Initialize calendar to current month on first load,** but restore from Zustand on subsequent visits within the same session. The `persist` middleware handles this automatically.
5. **Add to the Zustand migration** (version bump from Pitfall 5) to set sensible defaults for `calendarYear` and `calendarMonth`.

**Phase:** Calendar view implementation.

**Confidence:** HIGH (verified against existing Zustand store patterns for timeline state)

---

### Pitfall 8: Database Schema Bloat From New Entities Breaking Existing Queries

**What goes wrong:** Adding to-dos, context, and calendar-specific data introduces new models or significantly extends existing ones. The `Goal` model already has 25+ fields. Adding `isQuickTask`, `context` (JSONB), and potentially `calendarColor`, `allDay`, `startTime`, `endTime` pushes it past 30 fields. Prisma's `include` chains and `select` clauses become unwieldy. Existing queries that do `findMany` without `select` now return significantly more data than before, increasing API response sizes and memory usage.

**Why it happens:** The "extend the existing model" approach (recommended in Pitfall 1 and Pitfall 4) avoids entity proliferation but concentrates complexity in the `Goal` model. Every service method, API route, and MCP tool that touches goals now implicitly handles to-do fields, context fields, and calendar fields even when they are irrelevant to the operation. The Prisma Client returns all fields by default unless `select` is explicitly specified.

**Consequences:** API responses grow 30-40% larger due to new nullable fields being included in every goal list response. Mobile PWA performance degrades because the cached goal data is heavier. The MCP server returns context data in every `list_goals` response, wasting LLM context window. Prisma migrations for adding new columns to a populated `Goal` table require `ALTER TABLE ADD COLUMN` with defaults, which is fast for nullable columns but can lock the table briefly if default values are computed.

**Warning signs:**
- API response size doubling without doubling the number of goals
- TypeScript types for `Goal` exceeding 30 properties
- Multiple `select` clauses being added retroactively to existing queries
- MCP tool responses exceeding 4000 tokens for simple list operations

**Prevention:**

1. **Use `select` in all new list queries.** When fetching goals for the calendar view, select only the fields needed: `{ id, title, status, priority, deadline, categoryId, isQuickTask }`. Do not use `include: { category: true }` when only `categoryId` is needed for filtering.
2. **Keep new fields nullable with no default computation.** `isQuickTask Boolean @default(false)`, `context String?` (nullable) are safe additions that Prisma migrates instantly without table locks.
3. **Do NOT add calendar-specific time fields to Goal.** Goals have deadlines, not start/end times. The calendar view displays goals on their deadline date. If time-of-day scheduling is needed later, that is a separate concern (and an anti-feature per the original research: "Calendar sync / time blocking" is explicitly deferred).
4. **Create a goal list summary type** for API responses: `GoalSummary` with only the 10 fields views need (id, title, status, horizon, priority, deadline, progress, categoryId, isQuickTask, sortOrder). Full goal data (including context, SMART fields, notes) is returned only by `getById`.
5. **Audit existing MCP tool responses.** The `list_goals` tool should return summaries, not full goal objects. The `get_goal` tool returns the complete object including context.

**Phase:** Data model migration. Run this audit before adding new fields.

**Confidence:** HIGH (verified by reading existing service methods which use `findMany` without `select`, and the MCP tool handlers which return full goal objects)

---

### Pitfall 9: Calendar View Not Handling Timezone Correctly for Deadline Display

**What goes wrong:** Goals store deadlines as `DateTime` (UTC in PostgreSQL). The calendar renders days based on the user's local timezone. A goal with deadline `2026-04-08T22:00:00Z` shows on April 8 for a UTC user but should show on April 9 for a user in CET (UTC+2 in summer). Since the user is in Europe/Ljubljana (CET/CEST), deadlines set in the evening local time may appear on the wrong calendar day.

**Why it happens:** JavaScript `Date` objects automatically convert to the local timezone when accessed with `.getDate()`, `.getMonth()`, etc. But Prisma returns `DateTime` values as JavaScript `Date` objects in UTC. If the calendar grid maps goals to days using `goal.deadline.toISOString().slice(0, 10)` (which extracts the UTC date), goals assigned late in the day CET will appear one day early on the calendar.

**Consequences:** A goal with deadline "April 9 at midnight CET" (stored as `2026-04-08T22:00:00Z`) appears on April 8 in the calendar. User creates a goal "due today" but it appears on yesterday's cell. Recurring daily goals show on the wrong days, causing streak confusion.

**Warning signs:**
- Goals appearing one day early or late on the calendar
- "Due today" goals not showing in today's calendar cell
- Different behavior between server-rendered and client-rendered calendar dates
- Tests passing because the test environment timezone matches UTC

**Prevention:**

1. **Use `date-fns` consistently with timezone awareness.** The project already uses `date-fns` for date manipulation. When mapping a goal to a calendar day, convert the deadline to the user's local date: `format(goal.deadline, 'yyyy-MM-dd')` (which uses local timezone) rather than `goal.deadline.toISOString().slice(0, 10)` (which uses UTC).
2. **Store and compare dates as local dates for calendar display.** The `startOfDay` function from `date-fns` normalizes to local midnight. Use `startOfDay(goal.deadline)` to get the local calendar day.
3. **The date-range query for calendar data must account for timezone offset.** When fetching goals for April 2026 CET, the UTC range is approximately `2026-03-31T22:00:00Z` to `2026-04-30T21:59:59Z`, not `2026-04-01T00:00:00Z` to `2026-04-30T23:59:59Z`. Use `startOfMonth` and `endOfMonth` from `date-fns` which operate in local time, then pass those `Date` objects to Prisma (which will serialize them to UTC for the query).
4. **Add timezone to the user preferences** or use the system timezone. Since the app is single-user and the user's timezone is known (Europe/Ljubljana), this is a minor concern for v1 but should be handled generically for future multi-user support.

**Phase:** Calendar view implementation. Must be addressed in the date-range query logic.

**Confidence:** HIGH (this is a well-documented timezone pitfall in web applications; the existing codebase uses `date-fns` functions like `startOfWeek` with `weekStartsOn: 1` which confirms awareness of locale-specific date handling)

## Minor Pitfalls

### Pitfall 10: Quick-Add Ambiguity Between To-Do and Goal Creation

**What goes wrong:** The existing `QuickAdd` component creates goals with a title and optional horizon. After adding the to-do concept (`isQuickTask`), quick-add must decide whether to create a goal or a to-do. If it always creates to-dos, users cannot quickly create goals. If it always creates goals, the to-do feature feels disconnected. If it asks every time, it adds friction to the fastest creation path.

**Prevention:** Quick-add defaults to `isQuickTask: true` (since quick creation implies a lightweight task). The full "New Goal" button opens the form with `isQuickTask: false`. If the user is in a specific view (e.g., viewing goals filtered by a specific horizon), quick-add respects the context. Add a small toggle or keyboard shortcut (e.g., Tab to switch between "task" and "goal" mode) in the quick-add bar.

**Phase:** UI implementation, after data model is settled.

---

### Pitfall 11: Calendar View Day Selection Conflicting with Goal Selection

**What goes wrong:** The app already has a concept of "selected goal" (`selectedGoalId` in Zustand) which opens the detail panel. The calendar needs "selected day" to show that day's goals. If clicking a day also selects a goal (the first one on that day), the detail panel opens and narrows the calendar. If clicking a day only shows the day's goals list, there is no way to see goal details from the calendar.

**Prevention:** Implement a two-step interaction: (1) clicking a day highlights it and shows a day summary (list of goals for that day) in a popover or below the calendar grid, (2) clicking a specific goal within the day summary opens the detail panel. This separates day selection from goal selection. Consider using the bottom sheet pattern for day summaries on mobile.

**Phase:** Calendar view UI implementation.

---

### Pitfall 12: MCP Tool Count Exceeding LLM Comprehension After Feature Additions

**What goes wrong:** The MCP server already has 22 tools. Adding to-do specific tools (`create_todo`, `list_todos`), calendar tools (`get_calendar_data`, `get_day_summary`), and context tools (`set_context`, `get_context`) pushes the count to 28+. The original research (Pitfall 10) warned that "defining two tools that are very similar or too many tools will cause the model to call the wrong one or with wrong inputs."

**Prevention:** Do NOT add new tools for these features. Map them to existing tools:
- To-dos: `create_goal` with `isQuickTask: true` (no new tool)
- Calendar data: `list_goals` with a `dateRange` filter parameter (extend existing tool)
- Context: `update_goal` with a `context` field (extend existing tool)
- Day summary: `list_goals` with `deadline` filter for a specific date (no new tool)

The only potentially new tool is `get_calendar_overview` that returns a month-level summary (date -> goal count mapping) which is different enough from `list_goals` to warrant its own tool. That keeps the count at 23, well within the safe range.

**Phase:** MCP tool design, done alongside data model work.

---

### Pitfall 13: View Simplification Breaking Keyboard Shortcuts

**What goes wrong:** The existing keyboard shortcuts system (in `keyboard-shortcuts.tsx` and `command-palette.tsx`) includes shortcuts for switching between views. If "cards" and "board" views are removed, shortcuts like `Ctrl+1` through `Ctrl+4` shift their mappings. Users who learned `Ctrl+3` for "tree view" now get "timeline" because the numbering changed. Command palette actions referencing removed views cause errors.

**Prevention:**
1. **Audit all keyboard shortcut mappings** in `keyboard-shortcuts.tsx` and `command-actions.ts` before removing views.
2. **Reassign shortcuts deliberately** rather than letting array index shifts cause implicit remapping.
3. **Update command palette actions** to remove entries for deleted views and add entries for new views (calendar).
4. **Keep shortcut assignments stable:** If tree was `Ctrl+3`, keep it as `Ctrl+3` even after removing earlier views. Do not auto-number.

**Phase:** View simplification, same commit as view removal.

---

### Pitfall 14: Calendar View Competing with Timeline View for Temporal Display

**What goes wrong:** The app already has a timeline view showing goals across time. Adding a calendar view creates two temporal visualizations that partially overlap. Users are confused about when to use the timeline versus the calendar. The timeline shows goals as nodes on a horizontal axis; the calendar shows goals in a month grid. Both answer "what is happening when?" but in different ways.

**Prevention:** Define clear use cases:
- **Calendar:** "What is due on a specific day/week?" Tactical, short-term, action-oriented. Shows deadlines in a standard month grid. The primary view for daily/weekly planning.
- **Timeline:** "How do my goals progress over time?" Strategic, long-term, progress-oriented. Shows goal spans across quarters/years with hierarchy. The primary view for quarterly/yearly review.

Reinforce this distinction in the view switcher tooltips, onboarding hints, and command palette descriptions. Consider renaming "Timeline" to "Roadmap" to differentiate further.

**Phase:** Calendar view design, before UI implementation.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Data Model | Creating a separate Todo entity | Use `isQuickTask` flag on existing Goal model (Pitfall 1) |
| Data Model | Context system becoming a knowledge base | Single `context` field on Goal, not a separate entity (Pitfall 4) |
| Data Model | Schema bloat on Goal model | Use `select` in queries, create GoalSummary type (Pitfall 8) |
| View Removal | Persisted view state referencing deleted views | Zustand version bump with migration (Pitfall 5) |
| View Removal | Keyboard shortcuts shifting after view removal | Audit and deliberately reassign shortcuts (Pitfall 13) |
| Calendar View | Rendering all goals on every day cell | Date-bounded queries, aggregated recurring display (Pitfall 3) |
| Calendar View | Month state management conflicts | Zustand for month/year, local state for selected day (Pitfall 7) |
| Calendar View | Timezone-incorrect deadline display | Use date-fns local date functions, offset-aware range queries (Pitfall 9) |
| Calendar View | Day selection vs goal selection confusion | Two-step interaction: day summary, then goal detail (Pitfall 11) |
| Calendar + Timeline | Temporal view overlap confusion | Clear use case definitions, consider renaming Timeline (Pitfall 14) |
| Timeline Layout | Detail panel pushing timeline off viewport | ResizeObserver, min-width: 0, consider bottom sheet (Pitfall 6) |
| Recurring | Parallel habit/recurrence system | Reuse existing recurringService for quick tasks (Pitfall 2) |
| Quick Add | Ambiguous creation target | Default to quick task, toggle for full goal (Pitfall 10) |
| MCP Server | Tool count exceeding LLM comprehension | Extend existing tools, do not create parallel to-do tools (Pitfall 12) |

## Sources

- [Todoist vs TickTick: Focused Clarity or Feature Everything?](https://www.todoist.com/inspiration/todoist-vs-ticktick) (Todoist official, calendar comparison)
- [Designing A Streak System: The UX And Psychology Of Streaks](https://www.smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/) (Smashing Magazine, 2026, streak design patterns)
- [What is Feature Creep and How to Avoid It?](https://designli.co/blog/what-is-feature-creep-and-how-to-avoid-it) (feature creep prevention)
- [Feature Creep in Software Development](https://qat.com/feature-creep-in-software-development/) (scope management)
- [Performance optimization for React calendars](https://www.mintlify.com/Emendate/react-native-calendars/guides/performance) (calendar rendering optimization)
- [React calendar components: 6 best libraries 2025](https://www.builder.io/blog/best-react-calendar-component-ai) (library comparison)
- [How to Redesign a Legacy UI Without Losing Users](https://xbsoftware.com/blog/legacy-app-ui-redesign-mistakes/) (view removal UX patterns)
- [Nearform: Implementing MCP Tips, Tricks and Pitfalls](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) (MCP tool design)
- [TickTick vs Todoist](https://medium.com/@nickhuk/ticktick-vs-todoist-7ec863074edd) (calendar feature comparison)
- Existing codebase analysis: `ui-store.ts`, `goal-service.ts`, `recurring-service.ts`, `gamification-service.ts`, `dashboard-service.ts`, `goals/page.tsx`, `goal-view-switcher.tsx`, `schema.prisma`

---
*Confidence levels: HIGH = verified against existing codebase + official docs/production case studies. MEDIUM = verified with multiple community sources. LOW = synthesized from training data only.*
