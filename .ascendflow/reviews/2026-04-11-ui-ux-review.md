# Ascend UI/UX Review — 11. 4. 2026

**Reviewer:** ascend-ui-verifier workflow run inline in main session
**Method:** Playwright end-to-end walkthrough of every authenticated page at 1728×1013 viewport against the local dev server on `http://localhost:3100`
**Scope:** behavioral and visual review of `/dashboard`, `/goals` (list + tree + timeline), `/todos`, `/calendar`, `/context`, `/settings`, `/docs`, `/goals` "New Goal" modal, goal detail panel, todo detail panel, command palette (Cmd+K), category sidebar tree, delete confirmation dialog.
**Calibration:** against the canonical Ascend design rules in `.claude/agents/ascend-ux.md` and `.claude/rules/component-patterns.md`.

**Overall verdict:** **NEEDS ATTENTION.** The app is structurally sound and the core flows work, but there are two runtime bugs (one critical, one pre-existing) and roughly 40 UX findings spanning visual polish, interaction affordances, empty states, information architecture, and cross-page consistency. The biggest single issue is that Cmd+K crashes — a documented core feature that is completely unusable today.

---

## Implementation status (updated 11. 4. 2026, same session)

Phase A from the implementation plan is **substantially complete**. The following are shipped and verified via Playwright re-run:

| ID | Status | Commit |
|----|--------|--------|
| **C1** command palette `<Command>` wrapper | **DONE** | `871a075` |
| **C2** Base UI Button warning on dashboard | **DONE** | `1d80ade` (bundled with H2) |
| **H1** duplicate horizon filter | **DONE** | `cc684dc` |
| **H2** dashboard header button consolidation | **DONE** | `1d80ade` |
| **H3** PWA install banner desktop gate | **DONE** | `1858a72` |
| **H14** enum display labels in goal modal | **DONE** | `ad092e7` |
| **H15** `__none__` → "No category" | **DONE** | `ad092e7` |
| **M5** active filter count badge | **DONE** | `cc684dc` (bundled with H1) |
| **M16** always-visible "Clear all" button | **DONE** | `cc684dc` (bundled with H1) |
| **M6** X close button on detail panels | **INVALID** (already exists; I missed it in the initial screenshot pass because `size="icon-sm"` is 28×28. Downgrading to Low "close button should be more prominent".) |

**Six atomic commits, all Phase A Critical and High items resolved.** Phase B is still queued:

| ID | Status | Notes |
|----|--------|-------|
| H4 goal detail panel overhaul | **QUEUED** | Large scope: add Progress section, Sub-goals list, Parent breadcrumb. Requires component work + data-shape verification. |
| H5 todos table overwhelm with recurring instances | **QUEUED** | Requires new "Due today / Overdue / This week / All" tab row, default filter, group-by-title for recurrences. |
| H6 todo row checkbox bulk-vs-completion conflict | **QUEUED** | Design call needed: recommend replacing checkbox with circle→check completion, move selection to hover. |
| H7 todo detail status dropdown + complete button redundancy | **QUEUED** | Design call: recommend removing dropdown, keeping Complete/Reopen toggle. |
| H8 calendar wastes horizontal space | **QUEUED** | Layout refactor of `calendar-month-grid.tsx`. |
| H9 calendar day cells lack indicators | **QUEUED** | New data-aware cell renderer. |
| H10 dashboard widget empty-state CTAs | **PARTIAL** | Today's Big 3 already has a "Set priorities" button, which I missed in the initial review. Progress Overview and Upcoming Deadlines still need CTAs. |
| H11 goal modal "Advanced options" hiding SMART | **QUEUED** | Restructure modal to surface SMART as Step 2. |
| H12 Level & Stats widget dedup | **QUEUED** | Remove duplicate Level card, reorder stats. |
| H13 "Plan Your Day" widget inconsistent presence | **QUEUED** | Move to day detail panel header. |

All Medium and Low findings remain queued for a future session. Queue via `/continue`.

### Phase A re-verification summary

Final Playwright walkthrough after all Phase A commits, on `http://localhost:3100`:

1. **Command palette (Cmd+K):** opens without error on `/goals`. 5 groups, 13 items visible (Navigation, Views, Goals, Theme, Categories). Search input accepts text. Escape closes. **C1 green.**
2. **Goal modal:** Horizon combobox shows "Weekly▼" (was "WEEKLY▼"), Priority shows "Medium▼", Category shows "No category▼". **H14+H15 green.**
3. **Goals filter bar:** 3 dropdowns (Status, Priority, Category), no horizon combobox. Clear all button always visible with count badge when filters active. Clicking Smoke Test in the sidebar sets categoryId filter, badge shows "1", button enables. Click Clear all, badge disappears, button disables. **H1+M5+M16 green.**
4. **Dashboard header:** shows exactly "New To-do" and "New Goal" buttons. Zero console errors. **H2+C2 green.**
5. **Install Ascend banner:** not rendered at 1728×1013. `matchMedia("(min-width: 1025px)").matches === true` verified via `browser_evaluate`. **H3 green.**

Zero new console errors across all five checks. All six commits clean on `main`, not yet pushed.

---

## Severity legend

- **Critical** — broken feature, hard user block, data correctness, security. Ship-blocker.
- **High** — significant UX cost, UX inconsistency against stated design rules, missing primary affordance. Should fix before anything else ships.
- **Medium** — friction or polish gaps that degrade the experience without breaking it.
- **Low** — small refinements that accumulate into "feels rough".
- **Nitpick** — cosmetic, optional, worth mentioning for consistency.

---

## Critical (2)

### C1. Command palette (Cmd+K) throws on open

**What.** Pressing Cmd+K anywhere in the authenticated app triggers a Next.js runtime error overlay:

```
TypeError: Cannot read properties of undefined (reading 'toLocaleLowerCase')
  at components/command-palette/command-palette.tsx:74
```

The error is a `cmdk` internal filter call. Reproduced on `/goals` and `/dashboard`.

**Root cause.** `components/ui/command.tsx:50-66` defines `CommandDialog` as:

```tsx
function CommandDialog({ title, description, children, ... }) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent ...>
        {children}          {/* ← missing <Command> wrapper */}
      </DialogContent>
    </Dialog>
  )
}
```

There is no `<Command>` (cmdk root) wrapper around `{children}`. Every `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem` rendered inside runs without the cmdk context. The internal filter walks items whose `value` prop was never registered through the context, gets `undefined`, and crashes on `.toLocaleLowerCase()`.

Shadcn's canonical `command.tsx` wraps children in a `<Command>` inside the dialog content. Ascend's copy dropped it at some point.

**Why it matters.** Cmd+K is called out as a core feature in `CLAUDE.md` and the `ascend-ux` agent's design rules. It's in the two-panel layout's footer, it's referenced in the command-actions hook with 10+ defined actions, and it's the fastest way to navigate the app. It is 100% broken today.

**How to fix.**

```tsx
// components/ui/command.tsx
function CommandDialog({ title, description, children, className, showCloseButton = false, ...props }: ...) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className={cn("top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0", className)} showCloseButton={showCloseButton}>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]_svg]:size-4 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-4">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}
```

Fix is literally one element wrap around `{children}`. After the fix, verify Cmd+K opens the palette on every page, search filters results, Escape closes.

**Owner suggestion:** `ascend-dev`.

---

### C2. Pre-existing Base UI `Button` warning on `DashboardPage`

**What.** On every mount of `/dashboard`, the console fires:

```
[ERROR] Base UI: A component that acts as a button expected a native <button> because the `nativeButton` prop is true.
Rendering a non-<button> removes native button semantics, which can impact forms and accessibility.
Use a real <button> in the `render` prop, or set `nativeButton` to `false`.
  at Button (...)
  at DashboardPage (...)
```

**Why it matters.** This is an accessibility correctness issue. A screen reader or keyboard user hitting the affected button will not get button semantics (role, keyboard activation). The component tree in the stack points to `DashboardPage` — likely one of the header action buttons ("New To-do", "New Weekly Goal", "New Yearly Goal") or one of the widget header buttons. The warning is classified as ERROR by Base UI, not Warning, so it shows up in every console-error sweep and pollutes the signal.

**How to fix.** Grep `components/dashboard/` for `<Button` usages that wrap something other than a native `<button>`, and either (a) set `nativeButton={false}` on the Button prop to acknowledge the non-button render, or (b) restructure the render slot to use a real `<button>`. Because the stack trace passes through Next.js's obfuscated chunk paths, the exact line needs to be identified by reading through each dashboard widget file and looking for `<Button` with a `render={<a ...>}` or similar slot.

Best starting point: `components/dashboard/dashboard-page.tsx` header region where the three "New ..." buttons live.

**Owner suggestion:** `ascend-ux` for the audit, `ascend-dev` for the fix.

---

## High (15)

### H1. Duplicate horizon filter on `/goals` — tab row + combobox

**What.** The Goals page shows a horizon filter in TWO places:

1. A tab row with 5 tabs: All, Yearly, Quarterly, Monthly, Weekly
2. A combobox in the filter bar labeled "All horizons" with the same 5 options

**Why it matters.** Cognitive overhead and confusion. A user who clicks the "Weekly" tab then opens the "All horizons" combobox sees "All horizons" still selected and assumes the tab is just a visual shortcut — or worse, sets both and gets conflicting filter state. Dual-control UI for a single filter is a classic anti-pattern.

**How to fix.** Keep the **tab row** as the primary horizon filter (more visible, faster to use, fewer clicks) and **remove the Horizon combobox from the filter bar**. Keep the other three comboboxes (Status, Priority, Category) in the filter bar where they are. The Zustand `useUIStore` state for horizon filter is already shared, so removing the combobox is a pure UI delete; no logic changes.

Reference: `components/goals/goal-filter-bar.tsx`, `components/goals/goal-horizon-tabs.tsx` (or wherever the tabs live).

**Owner:** `ascend-ux`.

---

### H2. Dashboard header has arbitrary horizon quick-action buttons

**What.** The `/dashboard` header shows three action buttons:

- New To-do
- New Weekly Goal
- New Yearly Goal

**Why it matters.** Why only Weekly and Yearly? There are four horizons. The asymmetry is unmotivated and reads like a UI placeholder someone forgot to finish. It also pushes the user into a "start from the biggest or the smallest" mental model that isn't the app's actual value prop (the hierarchical Year → Quarter → Month → Week cascade).

**How to fix.** Replace the three buttons with **two**:

- **New To-do** (unchanged, fast-path to create an input)
- **New Goal** (opens `goal-modal` with Horizon defaulted to WEEKLY, which is the most common use case)

The goal modal already has a Horizon dropdown for the user to upgrade to QUARTERLY or YEARLY if needed. This is fewer buttons, more consistent with the "any horizon" mental model, and matches the "New Goal" button on `/goals`.

Reference: `components/dashboard/dashboard-page.tsx` header region.

**Owner:** `ascend-ux`.

---

### H3. PWA "Install Ascend" banner is a permanent fixture on desktop

**What.** Every authenticated page shows a small "Install Ascend / Add to your home screen for quick access" panel in the bottom-right, complete with an "Install" button. The banner is a fixed-position element that floats over content and is visible on desktop at 1728×1013.

**Why it matters.**

1. PWA install is a **mobile** feature primarily. Desktop users see a persistent nag banner on every page for something they have no use for.
2. It consumes ~200×80 px of valuable real estate on every page, obscuring the bottom-right of whatever you're looking at.
3. There is no visible "Dismiss" affordance — only "Install" and a small close icon that's easy to miss.
4. Even on mobile, a persistent nag is inferior to a one-time prompt after the user has engaged with the app a few times.

**How to fix.**

- Only render the install banner when `window.matchMedia("(display-mode: standalone)").matches === false` AND `isInstallable === true` (i.e., the PWA install prompt is actually available).
- Hide the banner on viewports wider than ~768 px unless the user has a PWA install hint on desktop (Chrome on Windows/Mac sometimes surfaces one).
- Add a clear "Not now" / "Don't show again" action that sets a localStorage flag so dismissal persists.

Reference: grep `components/pwa/` and `components/layout/` for "Install Ascend".

**Owner:** `ascend-ux` for the design call, `ascend-dev` for the viewport and matchMedia gating.

---

### H4. Goal detail panel is missing the core "progress" affordance

**What.** The goal detail panel for goal "2026" shows:

- Title
- Status dropdown
- Priority dropdown
- SMART Goal section (5 empty "Click to add..." fields)
- Deadline, Start Date
- "Xp per goal: 500 pts" (static label)
- "Assign goal" button
- "Delete Goal" button (red)

It does **not** show:

- A progress bar / progress percentage
- A progress-increment action ("+1 pushup", "+5 minutes", "Log progress")
- A progress history list
- A children-goals list (2026 is a parent of Q2 2026 → April focus → Week 15 sprint)
- A breadcrumb to the parent goal
- A linked todos list

**Why it matters.** Ascend is a **goal tracking** app. Progress is the single most important signal for a goal. The `dashboardService` explicitly computes `progressOverview`, the schema has a `progress` int field on every goal, there's a `progress-increment.tsx` component in the catalog, and the CLAUDE.md entity model describes `ProgressLog` as a first-class time-series. None of that surfaces in the detail panel. A user opens a goal, wants to log "I did 20 pushups today", and has nowhere to click.

**How to fix.**

1. Add a **Progress** section to `goal-detail.tsx`, between Status/Priority and SMART fields. Include:
   - A progress bar (`components/ui/progress.tsx`) showing `goal.progress` as a percent.
   - If `goal.targetValue` is set: show `{currentValue} / {targetValue} {unit}` next to the bar.
   - A `components/goals/progress-increment.tsx` input to log a new progress value (already exists in the catalog).
   - A collapsed "Progress history" expander using `progress-history-sheet.tsx`.
2. Add a **Sub-goals** section if `goal.children.length > 0`, listing each child with its own mini progress bar, clickable to drill in.
3. Add a **Parent** breadcrumb chip at the top of the panel (`← 2026`) if `goal.parentId` is set.

Reference: `lib/services/goal-service.ts` already supports `getById` with `include: { children, parent, progressLogs }`. The data layer is ready; the UI is the gap.

**Owner:** `ascend-dev` (non-trivial, touches data + UI).

---

### H5. Todos table is overwhelming with recurring instances

**What.** `/todos` currently shows 23 rows, of which ~20 are identical "Daily smoke v2 / Pending / Low / Apr N" where N = 10, 11, 12, ..., 30. The rows run down the whole screen with no grouping.

**Why it matters.**

1. The eye can't find the non-recurring todos among the sea of duplicates.
2. Recurring todos for future dates (Apr 20, Apr 25) are not actionable today but still consume rows.
3. The default sort puts the earliest date first, so today's Big 3 are NOT at the top.
4. There's no way to hide completed, hide future, or group by title.

**How to fix.** Multiple changes stacked:

1. **Default filter: show only today and overdue.** Add a "Due today" / "Overdue" / "This week" / "All" tab row at the top of `/todos` (mirroring the horizon tabs on `/goals`). Default to "Due today + Overdue". Persist the tab selection in `useUIStore`.
2. **Group consecutive recurring instances** by title when there are >3 in a row, showing a "+N more instances" collapse marker.
3. **Add a "Hide completed" toggle** in the filter bar. Default on.
4. **Default sort: Big 3 first, then by due date ascending.** Currently it looks like the order is by `createdAt` or `sortOrder`, which doesn't help a planning flow.

Reference: `components/todos/todo-list-view.tsx`, `components/todos/todo-filter-bar.tsx`, `lib/stores/ui-store.ts` (add the new tab state).

**Owner:** `ascend-dev`.

---

### H6. Todo row checkbox is bulk-selection, not completion

**What.** Each row in the `/todos` table has a checkbox in the leftmost column. Clicking it selects the row for bulk operations (appears in a floating action bar at the bottom: "1 selected / Complete / Delete"). It does **not** toggle the todo's `status` directly.

**Why it matters.** Every todo app in the world uses a checkbox as the primary "done" toggle. The current UI breaks that muscle memory. The user clicks expecting to mark done, nothing happens visually on the row's status cell, and they think the app is broken. It took me (the agent) three attempts to realize this during the dogfood verification run, and I have the source code.

**How to fix.** Pick one of:

**Option A (recommended):** replace the leftmost checkbox with a **circle → checkmark** button that toggles `TodoStatus.PENDING ↔ TodoStatus.DONE` directly. Use the shadcn `Checkbox` if you want, but rename its handler to complete/uncomplete. Move bulk selection to a **secondary** mechanism: Shift+click the circle to select, or a "Select" button in the row's hover actions.

**Option B:** keep the checkbox as selection but visually distinguish it as a selection control (e.g., only show it on row hover, or use a dotted square instead of a solid checkbox). Add a separate **circle-check icon button** in the row's leading content for completion.

Reference: `components/todos/todo-list-view.tsx`, `components/todos/todo-bulk-bar.tsx`.

**Owner:** `ascend-ux` (design call) + `ascend-dev` (implementation).

---

### H7. Todo detail panel has both a Status dropdown AND a separate Complete button

**What.** Opening a todo detail panel shows:

- `Status: Pending ▼` dropdown (values: Pending, Done, Skipped)
- A separate `Complete` button next to it

**Why it matters.** Redundant UI for the same state transition. If the user changes status via the dropdown to "Done", the Complete button becomes a no-op. If they click Complete, the dropdown should flip to "Done" but the visual relationship is unclear. And neither of them is the "Reopen" button (which I found appears only after Complete is clicked).

**How to fix.** Pick one:

- **Option A:** remove the Status dropdown from the detail panel. Use two state buttons: `✓ Complete` (when pending) or `↻ Reopen` (when done). Matches the reversible-done-state design rule.
- **Option B:** remove the separate Complete button. Use only the Status dropdown. More flexibility (you can go directly to Skipped) but less obvious.

**A** matches Ascend's "reversible done state" rule better.

Reference: `components/todos/todo-detail.tsx`.

**Owner:** `ascend-ux`.

---

### H8. Calendar uses a small fraction of available horizontal space

**What.** On `/calendar` at 1728×1013, the month grid occupies roughly the left 40% of the main content area. The right 60% is an empty "Select a day to see details" placeholder.

**Why it matters.**

1. Wasted real estate. On a typical laptop the month grid could be 2x wider and still leave room for a detail panel.
2. The day cells are small (roughly 90×60 px) which makes them feel cramped and the "dots for todos" affordance (see H9) impossible to fit.
3. The "Plan Your Day" widget that sits above the grid takes more vertical space than the week rows combined.

**How to fix.** Either:

**Option A:** widen the calendar to fill roughly 65-70% of the main content area, keeping the detail panel on the right at 30-35%. Increase day-cell size proportionally.

**Option B:** switch to a **two-column-aware layout** where if no day is selected, the calendar takes 100% width. When a day is selected, the calendar compresses to 60% and the detail panel slides in at 40%. This matches the `/goals` two-panel pattern.

Reference: `components/calendar/calendar-month-grid.tsx`, `app/(app)/calendar/page.tsx`.

**Owner:** `ascend-ux`.

---

### H9. Calendar day cells have no indicator for days with todos or goals

**What.** Every day cell in the month grid shows only its day number. There is no visual indicator for days that have todos, goals with deadlines, Big 3 set, or recurring instances.

**Why it matters.** The whole point of a calendar view is to see at-a-glance which days have stuff. Without indicators, the user has to click each day to discover. That's the opposite of a calendar view; it's more like a date picker.

**How to fix.** Add per-cell indicators:

- A small colored dot at the bottom of the cell for each todo type (one dot for pending, one for Big 3, one for a goal deadline).
- Cap at ~3 dots visually; if more, show "+N" text.
- Color codes matching the Ascend design language: neutral for pending, orange for Big 3, red for deadline, green for completed.
- Also: make the cell border highlight or background tint change when a day has any items.

Reference: `lib/hooks/use-todos.ts` already has `useTodosByRange` or similar; fetch the whole month and render the badges from that one query.

**Owner:** `ascend-dev`.

---

### H10. Dashboard empty states have no calls to action

**What.** Three dashboard widgets show passive empty states with no way to act:

- **Today's Big 3:** "No priorities for today" — no "Set Big 3" button.
- **Progress Overview:** "Assign goals to categories to see progress breakdown." — no link to category assignment.
- **Upcoming Deadlines:** "No upcoming deadlines. Your schedule is clear." — no "Add deadline" or link to goals.

**Why it matters.** A dead-end empty state makes the user feel like the app is waiting passively. An empty-state CTA is the single highest-ROI UX investment for engagement. Ascend's quality bar requires "friendly" empty states per `component-patterns.md`; they are friendly but not actionable.

**How to fix.** Each empty state gets a primary action button:

- **Today's Big 3** → "Pick 3 todos →" button that opens the todo list with a Big 3 picker.
- **Progress Overview** → "Assign categories →" button that navigates to `/goals` with a filter/helper for uncategorized goals.
- **Upcoming Deadlines** → "Set a deadline →" button that opens the goal modal with a date field focused, OR navigates to `/goals` and filters for goals without deadlines.

Reference: `components/dashboard/dashboard-page.tsx` and the individual widget files.

**Owner:** `ascend-ux`.

---

### H11. Goal modal "Advanced options" hides SMART fields

**What.** The "Create Goal" modal shows: Title, Horizon, Priority, Category, and a collapsed "Advanced options" expander. The SMART fields (Specific, Measurable, Attainable, Relevant, Timely), which are the **central differentiator** of the Ascend concept, live inside Advanced.

**Why it matters.** If SMART is a core concept of the product (per the schema and the agent definitions), hiding it behind "Advanced" signals to the user that it's optional and unimportant. They'll skip it, fill in only Title, and lose 80% of the value of the tool. This is a product-positioning issue as much as a UI one.

**How to fix.** Restructure the modal:

- **Step 1 (always visible):** Title, Horizon, Priority, Category, Parent Goal, Deadline.
- **Step 2 (expander or second tab, labeled "SMART Goal"):** the 5 SMART fields, with a short explainer above ("A SMART goal is Specific, Measurable, Attainable, Relevant, and Timely. Filling these in takes a minute and massively increases your follow-through.").
- Do **not** label it "Advanced". Label it what it is: "SMART Goal" or "Make this SMART".

Reference: `components/goals/goal-modal.tsx`, `components/goals/goal-form.tsx`.

**Owner:** `ascend-ux`.

---

### H12. Level & Stats widget is information-dense and partly redundant

**What.** The dashboard Level & Stats widget shows:

- A "Level 1" heading with a progress bar "10 / 100 XP"
- Below that, a 3×2 grid of stat cards: Level (1), Weekly score (20 pts), Active streaks (0), Completed this month (0), Completion rate (0%), Total completed (0)

**Why it matters.** Level is shown twice (once as heading, once as a card). The 3×2 grid is dense without a clear reading order. Some stats are correlated (Completed this month vs Total completed — why both?). The widget competes for attention with the Progress Overview widget next to it.

**How to fix.**

1. **Remove the duplicate Level card.** Keep it only in the heading + progress bar.
2. **Reorder the remaining 5 stats** into an intentional grouping:
   - **"This week"** row: Weekly score, Active streaks
   - **"All-time"** row: Total completed, Completion rate
   - **"This month"** row: Completed this month
3. Use smaller card chrome (less padding) so the widget feels tight and scannable, not bloated.

Reference: `components/dashboard/level-stats-widget.tsx` or wherever the stats card lives.

**Owner:** `ascend-ux`.

---

### H13. "Plan Your Day" widget has inconsistent presence on `/calendar`

**What.** On initial load of `/calendar`, a "Plan Your Day" widget appears at the top, showing recurring todos for today ("Daily smoke v2") with Start and "Skip for now" buttons. After clicking any day OTHER than today, the widget disappears. Clicking back to today does NOT bring it back.

**Why it matters.** Inconsistent presence of a prominent widget makes users think they accidentally broke something. It's also unclear what the widget does — is it a morning-planning prompt? A daily ritual starter?

**How to fix.** Either:

**Option A (recommended):** scope the widget to the day header in the day detail panel, not to the calendar grid. When you click a day and its detail panel opens on the right, the detail panel header shows "Plan [Day name]" with the start-day ritual affordance. Removing it from the main grid frees vertical space for the calendar.

**Option B:** keep the widget in its current position, but make it only show when today is the selected day (and dismiss it per-session once the user has clicked Start or Skip).

Reference: `components/calendar/morning-planning-prompt.tsx`, `components/calendar/calendar-day-detail.tsx`.

**Owner:** `ascend-ux`.

---

### H14. Status/Priority dropdowns render raw enum values in some places

**What.** In the "Create Goal" modal, the Horizon and Priority dropdowns show the raw uppercase values: `WEEKLY ▼`, `MEDIUM ▼`. In the `/goals` filter bar and the list-view table cells, the same values show Title Case: `Weekly`, `Medium`. The inconsistency is jarring when you navigate between the two.

**Why it matters.** Visual inconsistency signals low polish. A user opening the modal right after seeing the table thinks "why did the label change?".

**How to fix.** Pick **Title Case** as the single display convention. Create a small enum display helper:

```ts
// lib/enum-display.ts
export const horizonLabel: Record<Horizon, string> = {
  YEARLY: "Yearly",
  QUARTERLY: "Quarterly",
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
};
// ... same for priority, status, todo status
```

Use this helper in every display site. Do NOT call `.toLowerCase()` inline in components — centralize it.

Reference: every component that renders an enum value. `components/goals/goal-modal.tsx`, `components/goals/goal-filter-bar.tsx`, `components/goals/goal-status-select.tsx`, `components/todos/todo-filter-bar.tsx`.

**Owner:** `ascend-dev` (small but touches many files).

---

### H15. Category modal shows `__none__` as raw placeholder

**What.** In the goal create modal, the Category dropdown's default (empty) state displays the literal string `__none__▼`.

**Why it matters.** That's a raw enum sentinel leaked to the user. Looks like a bug.

**How to fix.** Change the display to "No category" (or "Uncategorized" — pick one and be consistent). The underlying value can stay as `__none__` or `null`; only the label changes.

Reference: `components/goals/goal-modal.tsx` or `components/categories/category-select.tsx`.

**Owner:** `ascend-dev` (one-line fix).

---

## Medium (17)

### M1. `/docs` uses a completely different visual language

**What.** `/docs` renders a dark-themed developer documentation page (MCP API reference, curl examples) that is **outside** the app shell — no sidebar, no two-panel layout, different typography, different color palette.

**Why it matters.** Jarring context switch. A user clicking a link to `/docs` from within the app feels like they were teleported to a different product. Also: the docs are dev-facing API reference but users can reach them from a sidebar link (Settings → API Key → "documentation" link), so non-dev users who click it see cryptic curl examples.

**How to fix.** Two options:

- **A.** Move `/docs` into the app shell (use `app/(app)/docs/page.tsx`), theme it to match the rest of the app, and scope it to user-facing content (features, keyboard shortcuts, MCP tool reference in plain English).
- **B.** If `/docs` is really a developer-only reference, move it to a subdomain (`docs.ascend.nativeai.agency`) or prefix the route with something that signals "not the main app" (`/developer-docs`) and add a warning banner at the top: "This is the developer API reference. For user help, click Settings → Help."

**Owner:** `ascend-ux`.

---

### M2. Settings page is bare

**What.** `/settings` contains only three sections: API Key, Import Data, Export Data.

Missing settings a typical user would expect:
- Theme toggle (currently only in the sidebar bottom)
- Profile / display name
- Notification preferences
- Keyboard shortcut reference
- Sign out
- Delete account / reset data
- Units (metric/imperial for progress values)
- Locale (date format, week start)
- Gamification toggles (turn off XP/level if the user dislikes it)

**Why it matters.** A settings page with 3 options feels unfinished. Users explore settings to see what they can configure; an empty settings page signals "this app isn't done yet."

**How to fix.** Add sections for: Appearance (theme, density), Account (API key, sign out), Preferences (week start, date format, units), Notifications, Data (Import/Export/Reset), Keyboard Shortcuts (reference only). Even if some toggles are TODO stubs, the shell creates the impression of depth.

Reference: `app/(app)/settings/page.tsx`.

**Owner:** `ascend-ux`.

---

### M3. Sidebar shows leftover "Smoke Test" category

**What.** The sidebar category tree displays a "Smoke Test" entry that's clearly leftover test data from a previous session.

**Why it matters.** It's visible to any user opening the app on any device that has this data. Screenshots in demos look unpolished.

**How to fix.** Delete the Smoke Test category via `/goals` → Smoke Test → (category sidebar menu, probably right-click or hover actions) → Delete. Or via Prisma Studio. This is a data hygiene task, not a code fix.

**Owner:** this session can do it in the cleanup phase.

---

### M4. Goal list view doesn't distinguish goals with children from leaf goals

**What.** In the `/goals` list view, every row looks identical. There's no visual indicator that "2026" has children (Q2 2026) while "Smoke test goal" is a leaf.

**Why it matters.** In the tree view the indentation makes this obvious, but list view loses the hierarchy signal. Users who prefer list view (often because they want to sort by due date or progress) still need to know if a goal is a parent.

**How to fix.** Add a small caret `▸` / `▾` on hover next to the title for rows with children, clickable to expand inline (showing children indented underneath). Or add a "N sub-goals" badge after the title.

Reference: `components/goals/goal-list-view.tsx`.

**Owner:** `ascend-ux`.

---

### M5. Filter bar lacks an active-filter-count badge

**What.** Ascend's design rule (`ascend-ux.md` line 162) explicitly says: "Active filter count badge shows how many filters are applied." The current goals filter bar does not show such a badge.

**Why it matters.** Violation of the stated design rule. Also: a user who set a filter, navigated away, and came back has no quick visual cue that a filter is still active unless they read every combobox.

**How to fix.** Add a small numeric badge to the filter bar label (or next to a "Filters" header if you want to compress the bar on mobile) showing the count of non-default combobox values. Clicking the badge clears all.

Reference: `components/goals/goal-filter-bar.tsx`, `lib/stores/ui-store.ts` for reading the active filter state.

**Owner:** `ascend-ux`.

---

### M6. Detail panel close affordance is not clearly visible

**What.** Clicking a goal opens the detail panel on the right. Closing requires clicking somewhere else (deselecting), not a clear X button. The design rule (`ascend-ux.md` line 188) says: "Close button (X icon) top right."

**Why it matters.** Another design-rule violation. Users look for an X; when there isn't one, they feel trapped and click randomly to escape.

**How to fix.** Add an X button at the top-right corner of every detail panel (`goal-detail.tsx`, `todo-detail.tsx`, `context-entry-detail.tsx`). Close action dispatches `useUIStore.setState({ selectedGoalId: null })` or equivalent.

**Owner:** `ascend-ux`.

---

### M7. `/context` page shows only one dynamic document

**What.** `/context` shows a single entry: "Current Priorities" with a "Dynamic" badge. There is no visible list of user-created context entries (I see in the source that the service supports them).

**Why it matters.** The context system is supposedly a knowledge base for the user's operating system. A single auto-generated doc gives no sense of that.

**How to fix.** Either populate the sidebar with seeded context entries (a welcome doc, a "How I use Ascend" template, a weekly review template) for new users, or add a prominent "Create your first context document" empty-state CTA that links to a starter template. The "Dynamic" badge is a nice differentiator but needs context (pun intended).

Reference: `app/(app)/context/page.tsx`, `lib/services/context-service.ts`.

**Owner:** `ascend-ux` or `ascend-dev` depending on whether seed data is added.

---

### M8. Todo detail panel shows no recurring badge despite the todo being clearly recurring

**What.** Opening "Daily smoke v2" (which is clearly a recurring todo from its "v2" suffix and the 20+ instances on different dates) shows no recurring metadata in the detail panel.

**Why it matters.** The design rule says: "Recurring metadata (if applicable) shown with RepeatIcon." The data is there in `todo.isRecurring` and `todo.recurrenceRule`, the UI just doesn't render it.

**How to fix.** In `todo-detail.tsx`, if `todo.recurringSourceId || todo.isRecurring`, render a `<RepeatIcon />` badge next to the title with the human-readable rrule: "Repeats daily", "Repeats weekly on Tue, Thu". Use `rrule` library (already a dep) to convert the rrule string to text.

**Owner:** `ascend-dev`.

---

### M9. Delete confirmation dialogs missing throughout the app

**What.** I attempted to delete the probe todo and goal during the earlier verification run. Delete dialogs DID appear (confirming this works), but the experience was inconsistent — the todo delete opened a dialog, the goal delete opened a dialog, but neither had a clearly-labeled "Type the name to confirm" safeguard for destructive actions on goals with children. A yearly goal with 20 sub-goals could be lost with one click.

**Why it matters.** Destructive action without friction proportional to the loss is a data integrity risk.

**How to fix.** Tier the delete confirmations:

- **Leaf goal / todo / context:** simple "Are you sure? [Cancel] [Delete]".
- **Goal with 1+ children:** show the child count and tree preview. Require the user to type the goal title exactly to unlock the Delete button.
- **Category with assigned goals:** show the count of affected goals and todos and warn that categoryId will become null.

Reference: `components/goals/goal-delete-dialog.tsx`, extend to a "safety-tiered" variant for parent goals.

**Owner:** `ascend-dev`.

---

### M10. Keyboard shortcuts not discoverable in the UI

**What.** The CLAUDE.md lists keyboard shortcuts: Cmd+K, `/`, `g+g`, `g+t`, `g+c`. There is no visible reference for them in the UI. Users have to read the docs (which are broken per M1 anyway) to discover them.

**Why it matters.** Keyboard shortcuts only work if users know they exist. Power users will love them; casual users will never find them.

**How to fix.**

1. Add a `?` keyboard shortcut (common pattern) that opens a `KeyboardShortcutsDialog` listing all shortcuts grouped by category.
2. On the empty state of the search input in the command palette, show a hint: "Press Cmd+K from anywhere. Try `g g` to go to Goals."
3. On the sidebar nav links, show a subtle shortcut hint on hover: "Dashboard (g d)".

Reference: `components/command-palette/keyboard-shortcuts.tsx`, `lib/hooks/use-keyboard-shortcuts.ts`.

**Owner:** `ascend-ux`.

---

### M11. Loading states use implicit "blank then populated" instead of skeletons

**What.** On navigating to a page, the widget area blanks for a moment then populates with data. No `Skeleton` components visible during the React Query fetch.

**Why it matters.** Blank → populated looks laggy. Skeleton → populated looks fast even if it's the same total time. Design rule: "Use Skeleton for loading placeholders."

**How to fix.** Wrap every data-dependent widget in a skeleton fallback using the React Query `isPending` state:

```tsx
{isPending ? <Skeleton className="h-24 w-full" /> : <WidgetContent data={data} />}
```

Audit `components/dashboard/`, `components/goals/goal-list-view.tsx`, `components/todos/todo-list-view.tsx`, `components/calendar/calendar-month-grid.tsx` for missing skeletons.

**Owner:** `ascend-dev`.

---

### M12. "Today's Big 3" widget provides no hint of what Big 3 are

**What.** The dashboard widget is titled "Today's Big 3" with a star icon. Empty state says "No priorities for today". There is no explainer for what "Big 3" means or why a user would want to set them.

**Why it matters.** Big 3 is a Cal Newport / Stephen Covey concept. Assume your user has never heard of it. A one-line subtitle or tooltip would close the gap.

**How to fix.** Add a tooltip on the title icon: "Pick three todos to focus on today. Limiting to three forces clarity and feels great when you finish them." Or a subtitle directly below the title: "Three todos you'll finish today, no matter what."

Reference: `components/dashboard/big3-widget.tsx` or similar.

**Owner:** `ascend-ux`.

---

### M13. Calendar "Wk" column is unexplained

**What.** The calendar grid has a "Wk" column (week number) at the left edge of each row. No tooltip, no header explanation.

**Why it matters.** Week numbers are useful for anyone doing quarterly planning or sprints (Amadej explicitly uses "Week 15 sprint" as a goal title), but most users don't know what ISO week they're in. The column is unlabeled.

**How to fix.** Expand the header to "Week" (not abbreviated), or add a tooltip "ISO week number". Also consider making the week-number cell clickable to select the whole week.

**Owner:** `ascend-ux`.

---

### M14. Onboarding button appears only in the context page sidebar

**What.** Observed a button labeled "Onboarding" at the bottom-left of the sidebar only when on the `/context` page. On other pages (`/goals`, `/todos`, `/dashboard`) the same slot is empty or shows something else.

**Why it matters.** Inconsistent sidebar footer. The onboarding CTA should either be globally visible (for users who want to revisit the onboarding flow) or not visible at all (once onboarding is complete).

**How to fix.** Either surface the onboarding button globally in the sidebar footer with a "Show onboarding" tooltip, or remove it entirely from pages where onboarding is irrelevant.

Reference: `components/layout/app-sidebar.tsx`.

**Owner:** `ascend-ux`.

---

### M15. Goal status uses dropdown; goal delete is a separate "Delete Goal" button

**What.** In the goal detail panel, the Status dropdown is at the top (near title) but the Delete Goal button is at the bottom under a "Danger zone" heading. Meanwhile the Todo detail panel has the delete button right next to Complete. The patterns differ.

**Why it matters.** Cross-page inconsistency.

**How to fix.** Pick one placement for destructive actions across both detail panels. **Recommended:** bottom, under a "Danger zone" subheading, for both goals and todos. It's the common pattern (GitHub uses this in repo settings).

Reference: `components/goals/goal-detail.tsx`, `components/todos/todo-detail.tsx`.

**Owner:** `ascend-ux`.

---

### M16. Filter reset has inconsistent visibility

**What.** After clicking the "Smoke Test" category in the sidebar, a small "Clear all" chip appeared in the filter bar. Before that, the filter bar had no visible reset control at all.

**Why it matters.** Users shouldn't have to set a filter just to see where the reset is. The reset control should always be visible but disabled when no filters are active (grayed out or hidden with `opacity-50`), enabled and clearly clickable when any filter is set.

**How to fix.** Always render the "Clear all" button in the filter bar. Disable it when no filters are applied. Add an active filter count badge next to it (see M5).

**Owner:** `ascend-ux`.

---

### M17. Detail panel placeholder text has low contrast

**What.** The right-side detail panel area says "Select a goal to see details" (or "Select a day...", "Select a document...") in very light gray on a white/light background. Hard to read.

**Why it matters.** WCAG AA requires 4.5:1 contrast for body text. The current placeholder is closer to 3:1. Users with mild visual impairment or in bright-environment use (outdoors, direct sunlight on a laptop) will struggle.

**How to fix.** Increase the placeholder text color from the current light gray (`text-muted-foreground` at its lightest) to a slightly darker gray (`text-muted-foreground` at a higher saturation). Alternatively, use an icon + short label stacked ("📋 Select a goal to see details") which creates more visual weight.

Reference: `tailwind.config.js` or `app/globals.css` for the `--muted-foreground` token.

**Owner:** `ascend-ux`.

---

## Low (8)

### L1. Goals page placeholder "Select a goal to see details" is the only content in the right panel

**What.** When no goal is selected, ~60% of the goals page right side is empty except for the placeholder text.

**Why it matters.** Wasted real estate. An unselected state could surface something useful: today's top 3 goals, a "quick stats" view, or recent changes.

**How to fix.** When nothing is selected, show an "overview" card in the detail panel region: total goals by status, top 5 weekly focus goals, recent completions.

**Owner:** `ascend-ux`.

---

### L2. Sidebar toggle button at bottom is hard to find

**What.** The sidebar has a "Toggle Sidebar" button at the bottom-left corner (next to the theme toggle). It's small and icon-only with no tooltip at first glance.

**Why it matters.** Discoverability.

**How to fix.** Add a tooltip on hover ("Collapse sidebar (Cmd+B)"), move to the top-right of the sidebar header (next to the Ascend logo) for better visibility, and bind a keyboard shortcut.

**Owner:** `ascend-ux`.

---

### L3. Theme toggle is in the sidebar bottom, not in settings

**What.** The theme toggle button (sun/moon icon) lives in the sidebar bottom instead of `/settings`.

**Why it matters.** Users look in Settings for theme. It's there via the command palette too, but the first place a user checks is usually Settings.

**How to fix.** Keep the sidebar-bottom toggle for speed, but **also** add a theme selector row to the `/settings` page under an "Appearance" section.

**Owner:** `ascend-ux`.

---

### L4. "2026" as a goal title is placeholder-y

**What.** The top-level yearly goal is titled "2026". It's factual but not motivating.

**Why it matters.** Seeded test data that looks like seed data undermines the app's feel.

**How to fix.** Either rename in the database ("My 2026") or improve the seed script to generate more realistic titles. This is a data hygiene task.

**Owner:** this session cleanup.

---

### L5. No footer with app metadata

**What.** There is no visible footer on any authenticated page. The space at the bottom of every page is unused.

**Why it matters.** A footer is a good place for: app version, keyboard shortcut hint, "Built with..." credit, sync status.

**How to fix.** Add a thin fixed footer with app version, last-sync time, and a Cmd+K hint. Low priority but free polish.

**Owner:** `ascend-ux`.

---

### L6. "Add goal" button in quick-add is disabled without visible affordance for why

**What.** On `/goals` quick-add, the "Add goal" button is disabled until the user types in the input. The disabled state is grayed out but there's no tooltip explaining "Type a title first".

**Why it matters.** Users who click it and see nothing happen may think it's broken.

**How to fix.** Add a tooltip on the disabled state: "Type a title first". Or auto-enable on first keystroke without explanation (most common pattern).

**Owner:** `ascend-ux`.

---

### L7. Recurring goal field "Recurring Target" on goal detail panel is unexplained

**What.** The goal detail panel has a checkbox "Recurring Target" with a subtitle "Repeatable goal type". No explainer for what that means in terms of behavior.

**Why it matters.** Ascend has two recurring systems (for goals and todos; they're listed as a Danger Zone in CLAUDE.md). Users will be confused without a tooltip.

**How to fix.** Add a tooltip: "Turn this on to create weekly or monthly instances of this goal automatically."

**Owner:** `ascend-ux`.

---

### L8. Goal XP display "500 pts" is static and unexplained

**What.** Every goal detail panel shows "Xp per goal: 500 pts" as a static label. No interaction, no explanation.

**Why it matters.** If it's just informational, the placement steals attention from actually useful fields. If it's meant to suggest "you'll earn 500 XP when you complete this", the copy doesn't say so.

**How to fix.** Rewrite the copy: "Complete this goal to earn +500 XP" with a subtle sparkle icon. Position it near the Complete/Status affordance, not as a random stat card.

**Owner:** `ascend-ux`.

---

## Nitpick (5)

### N1. Dashboard subtitle "What are your inputs today?" is redundant with h1 "Dashboard"

The h1 already says what page we're on. A subtitle should add value (e.g., today's date, a motivational quote). Either remove or replace with the current date in European format.

### N2. "To-dos" with a hyphen is unusual

Standard is "Todos". Consistency across codebase (data layer uses `Todo`, not `To-do`) and user-facing vocabulary would improve.

### N3. Column header sort arrows are small

The sort indicator arrows on column headers are tiny and easy to miss. Make them slightly larger and bolder when active.

### N4. Next.js Dev Tools button floats in the bottom-right

Only visible in dev mode, not a production issue, but worth a note: the "Open Next.js Dev Tools" floating button competes with the PWA install banner for the same bottom-right space. Minor dev-experience ergonomic.

### N5. Sidebar logo "Ascend" is a text link to `/dashboard`

Acceptable, but a logomark + "Ascend" would be more premium. Also, the link's hover state is subtle; could benefit from a clearer indication that it's interactive.

---

## Cross-cutting themes

### Theme A: Empty states are dead ends

H10, M12, L1 all hit the same pattern: "the widget shows nothing and offers no action". Ascend is the kind of app where users will frequently be in an empty state (new install, fresh week, empty category). Every empty state needs a primary action. This is the single highest-ROI UX investment in this review.

### Theme B: Design rules from `ascend-ux.md` are documented but not enforced

At least 5 findings (M5 filter count badge, M6 detail close button, M8 recurring badge, H7 reversible done state, M11 loading skeletons) are violations of rules that already exist in `.claude/agents/ascend-ux.md`. The rules are well-written; the gap is that no one enforces them during implementation. This is why the `ascend-ui-verifier` agent exists (as of earlier this session). Run it on every UI change.

### Theme C: Information architecture spreads across horizons unevenly

The app has 5 top-level pages (Dashboard, Goals, Todos, Calendar, Context) plus Settings. But some pages feel half-finished (Settings has 3 sections; Context has 1 entry), while others are dense (Dashboard has 5 widgets, Goals has 3 views). This suggests the product is still defining its information architecture and the UI reflects the in-progress state.

### Theme D: Accessibility is mostly fine but has pockets of risk

WCAG AA contrast (M17), Base UI Button semantics (C2), focus rings (not explicitly reviewed but the design rule mentions it), keyboard shortcut discoverability (M10). No major a11y blockers but the Base UI error is a real issue that would fail an a11y audit.

---

## Prioritized implementation plan

If we do everything in this session:

### Phase A: Critical + fastest High wins (this session, ~45 min)
1. **C1** — command-palette `<Command>` wrapper (one-line fix in `components/ui/command.tsx`). Verify Cmd+K works on every page.
2. **H15** — `__none__` → "No category" label (one-line fix).
3. **H14** — enum display helper + use in goal modal dropdowns.
4. **M6** — add X close button to `goal-detail.tsx`, `todo-detail.tsx`, `context-entry-detail.tsx`.
5. **M5** — active filter count badge in `goal-filter-bar.tsx`.
6. **M16** — always-visible disabled "Clear all" button.
7. **H1** — remove duplicate horizon combobox from goals filter bar.
8. **H2** — consolidate dashboard header buttons to "New To-do" + "New Goal".
9. **H3** — gate PWA install banner to mobile + installable + not-dismissed.

### Phase B: High-impact behavior and visual (this session, ~60-90 min)
10. **H4** — goal detail panel: add Progress section, Sub-goals section, Parent breadcrumb.
11. **H7** — reconcile todo detail Status dropdown vs Complete button (remove dropdown, keep Complete/Reopen toggle).
12. **H10** — dashboard empty-state CTAs.
13. **H11** — rename "Advanced options" to "SMART Goal" in goal modal, change its framing.
14. **H12** — remove duplicate Level card in Level & Stats widget + reorder.
15. **H13** — scope "Plan Your Day" to day detail panel.
16. **C2** — find and fix the Base UI Button warning in dashboard-page.tsx.

### Phase C: Medium + cleanup (only if time permits)
17. **M1** — `/docs` theming pass or warning banner.
18. **M2** — expand `/settings` with Appearance and Account sections.
19. **M3** — delete "Smoke Test" category from the dev DB.
20. **M4** — list view expand-children affordance.
21. **M7** — seed context entries or empty-state CTA.
22. **M8** — recurring badge on todo detail panel.
23. **M10** — keyboard shortcuts dialog (`?` key).
24. **M11** — add Skeleton fallbacks to dashboard widgets.

### Phase D: Low / Nitpick (queue for a future session)
Everything else queues via `/continue`.

## Execution policy

Every phase must:

1. Be implemented by `ascend-dev` or `ascend-ux` subagents, not the main session.
2. Be committed atomically per finding (one commit per fix, grouped where it makes sense for very small adjacent fixes like H14+H15).
3. Pass `npx tsc --noEmit` and `npm run build` before commit.
4. Be re-verified via Playwright walkthrough of the affected page before the next fix starts.
5. Update this review document in-place to mark each finding as FIXED with the commit hash and date.

**Amadej, confirm Phase A + B as the scope for this session. I'll execute in order, verify each, and leave Phase C + D queued.**
