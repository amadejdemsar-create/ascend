# Ascend Design Critique

**Date:** 14. 4. 2026
**Reviewer:** Ascend UX agent
**Scope:** Full visual design audit across 12 surfaces
**Method:** Source-code reading (components, tokens, layouts) cross-referenced against the 2026-04-11 Playwright verification (`.ascendflow/reviews/2026-04-11-ui-ux-review.md`) and the project's canonical design references.
**Browser verification:** Not run in this session (chrome-devtools MCP not available). Screenshots folder is empty. Where findings rely on measured behaviour, I mark them as "verified 11. 4. 2026" or "needs re-verification".
**Dev server:** http://localhost:3001

---

## 1. Executive verdict

Ascend has a real, identifiable design language. The two-panel layout works. The click-to-edit detail pattern in `goal-detail.tsx` is genuinely good and should be the blueprint for the rest of the app. The color system is built on oklch tokens with dark mode mirroring, the typography pairing (Inter + Playfair + JetBrains Mono) is deliberate, and the motion system (view transitions, hover-lift, progress-bar-animated) shows intent.

The app is not polished, though. It sits at the "competent but inconsistent" phase of design maturity. Four structural problems recur across surfaces:

1. **Pattern drift.** The canonical detail/filter/quick-add patterns exist in goals. Todos partially follow them. Context actively breaks them. Nothing enforces consistency.
2. **Token bypass.** Analytics charts use `hsl(var(--primary))` (which is broken against the oklch token format) and hardcoded hex purples. The design system token table is not being honored at the leaf nodes.
3. **Density mismatch.** Dashboard widgets, todo details, and settings cards don't share the same vertical rhythm. Sections feel air-gapped in one place and crammed in another.
4. **Hidden affordances.** SMART fields, priority legends, calendar dot semantics, keyboard shortcut glyphs: users learn these by accident, not by signal.

None of this is catastrophic. But every one of them is the kind of thing that makes users describe an app as "clunky" or "feels off" without being able to say why. Fix them and Ascend jumps from "competent personal tool" to "product that feels considered".

**Verdict:** PASS WITH SIGNIFICANT NOTES. Ship-ready for a personal OS; not ship-ready as a positioning-led product. Priority is consolidating the patterns goals already prove, not adding new surfaces.

---

## 2. Five things done well

1. **Click-to-edit in `goal-detail.tsx`.** Title, description, SMART fields, priority, dates, progress — every editable field switches to input on click, saves on blur, cancels on Escape. Hover affordance is subtle (background shift, cursor change). This is the single best UX pattern in the app and genuinely elevates it above most personal-productivity tools. The linked todos list, parent breadcrumb, and children progress bar all live inside the same detail without modal gymnastics. File: `components/goals/goal-detail.tsx`.

2. **Typography pairing.** Playfair for h1/detail-title + Inter for body + JetBrains Mono for numbers and kbd glyphs. The serif on `Morning Planning` and on detail titles gives the app a distinctive voice that separates it from the Notion/Linear/Todoist visual cluster. The mono glyphs in the footer (`kbd border-border bg-muted px-1 py-0.5`) look considered. Files: `app/globals.css`, `components/calendar/morning-planning-prompt.tsx`, `app/(app)/layout.tsx:42-45`.

3. **Goal filter bar.** `goal-filter-bar.tsx` is the canonical reference it's supposed to be. Persisted via `useUIStore.activeFilters`, always-visible `Clear all` button with an active-count badge, dropdown selects with `GoalHorizonBadge`/`GoalPriorityBadge` inside `SelectValue`. This should be the template for every filter bar.

4. **Two-panel layout + sheet fallback.** `app/(app)/layout.tsx` wraps everything with SidebarProvider + SidebarInset + BottomTabBar, and detail panels fall back to `Sheet` on mobile. The structural bones are right and the mobile fallback is there (even if it's cramped — see H3 below).

5. **Morning planning prompt.** `components/calendar/morning-planning-prompt.tsx` is a tasteful, drag-drop Big 3 picker with a primary-tinted card background (`border-primary/20 bg-primary/5`), a serif header (`font-serif text-xl font-semibold`), and a clear completion CTA showing progress as `(filledCount/3)`. Dismissible, empty-state friendly, visually distinct from the rest of the calendar. This is the model for how one-off rituals should feel.

---

## 3. Critical gaps (must fix before any further surface work)

### C1. Analytics chart colors are broken at the token level
**File:** `components/analytics/todo-completion-chart.tsx`
**Problem:** `fill="hsl(var(--primary))"` cannot resolve because `--primary` is defined as `oklch(...)`, not as a three-number HSL triplet. Recharts receives the literal string `hsl(oklch(0.55 0.22 270))` and falls back to default rendering. Verified format mismatch by reading `app/globals.css`.
**Impact:** Charts silently render in wrong colors or default fills. The analytics page is the worst surface in the app because the design system itself is misconfigured at the leaf nodes.
**Fix:** Migrate to Tailwind v4's `var(--color-primary)` (which resolves to the oklch value), or switch to class-based fills (`className="fill-primary"`). Also applies to:
  - `components/analytics/xp-earned-chart.tsx` — uses hardcoded `hsl(270, 70%, 60%)`, bypasses tokens entirely.
  - `components/analytics/goal-progress-chart.tsx` — uses hardcoded `hsl(142, 71%, 45%)`.
**Effort:** 30 minutes. Single PR across the three charts. Must re-verify in both themes after.

### C2. Context entry breaks the canonical click-to-edit pattern
**File:** `components/context/context-entry-detail.tsx`
**Problem:** Markdown content is read-only in the detail panel. Editing requires clicking a pencil icon to open a separate `ContextEntryEditor` component. This directly contradicts the pattern goals and todos use.
**Impact:** Users have to learn two different editing models within the same app. The asymmetry is jarring: click a goal's description, it becomes editable; click a context entry's markdown, nothing happens.
**Fix options:**
  - Option A (preferred): inline textarea on click, render markdown on blur. This is what `goal-detail.tsx:description` does — same pattern extends cleanly.
  - Option B: if the markdown editor must stay separate (for live preview, toolbar, etc.), keep the pencil affordance but make the entire content area show a hover state + cursor that signals "click to edit", and open the editor as a side panel rather than replacing the detail. Do not leave the current stale-feeling read-only state.
  - Also: the wikilink click handler is stubbed (`toast.info(\`Link: ${title}\`)`). Wire it to `selectContextEntry` via `useUIStore`. Dead links kill trust.
**Effort:** 2-3 hours for Option A, including sanitization of contentEditable input.

### C3. Todo filter state is not persisted, diverges from goals
**Files:** `app/(app)/todos/page.tsx`, `components/todos/todo-filter-bar.tsx`
**Problem:** Todos page uses local `useState<TodoFilters>({})` while goals persist through `useUIStore.activeFilters`. The `todoDateTab` and `todoHideCompleted` settings ARE in Zustand, so the model is already mixed within the same page — the worst possible state.
**Impact:** User sets `priority=HIGH` on todos, navigates to dashboard, comes back → filter is gone. On goals, it persists. Predictability is broken.
**Fix:** Add `todoFilters` slice to `lib/stores/ui-store.ts`, mirror the `activeFilters` shape. Bump the persistence version. Port `todo-filter-bar.tsx` to read/write from the store, mirror the `Clear all` + active-count badge from `goal-filter-bar.tsx`.
**Effort:** 1 hour.

### C4. Analytics surface is thin
**Files:** `components/analytics/*`
**Problem:** Only three charts exist: todo completion, XP earned, goal progress. Given Ascend's positioning as a tracking-first personal OS, this is the weakest surface relative to user expectation. No streak visualization, no category breakdown, no Big 3 hit rate, no weekly rhythm heatmap.
**Impact:** The `/analytics` route feels like a stub, not a destination.
**Fix:** Before adding more surfaces elsewhere, round out analytics to at least: (1) 12-week streak calendar, (2) category distribution (donut) of completed todos, (3) Big 3 hit rate over the last 4 weeks, (4) goals-by-horizon count chart. All data exists in services already.
**Effort:** 1 day. Gate this behind C1 fix — no point adding more broken charts.

---

## 4. High-priority improvements

### H1. H1 sizing is inconsistent across pages
**Files:** `components/dashboard/dashboard-page.tsx`, `app/(app)/settings/page.tsx` (both `font-serif text-3xl font-bold`); `app/(app)/goals/page.tsx`, `app/(app)/todos/page.tsx`, `app/(app)/calendar/page.tsx` (all `text-2xl`).
**Problem:** The dashboard and settings h1s are a full step larger than the rest of the app. There's no semantic reason.
**Fix:** Standardize on `font-serif text-2xl font-bold tracking-tight` for every primary page h1. Reserve text-3xl for detail titles (which already use it in `goal-detail.tsx:title`).

### H2. Goal priority MEDIUM badge is visually loud
**File:** `components/goals/goal-priority-badge.tsx`
**Problem:** HIGH → `destructive` (red), MEDIUM → `secondary` (violet), LOW → `outline`. The violet for MEDIUM is brighter than the red for HIGH in most contexts because `secondary` is a saturated solid while `destructive` sits against a lighter backdrop. Users read MEDIUM as "important" because it's the most visually dominant.
**Fix:** HIGH → destructive, MEDIUM → muted amber or outlined amber, LOW → outline muted. Equivalent change: HIGH → `bg-destructive/10 text-destructive border-destructive/30`, MEDIUM → `bg-amber-500/10 text-amber-600 border-amber-500/30`, LOW → `bg-muted text-muted-foreground`. Pattern already established in `components/calendar/calendar-month-grid.tsx` dots.

### H3. Mobile detail panels are cramped
**Files:** `components/goals/goal-detail.tsx`, `components/todos/todo-detail.tsx`
**Problem:** Detail panel content is laid out for the desktop right-pane. On mobile it renders inside a `Sheet` but the vertical rhythm doesn't adapt: SMART grid is 2-col, breadcrumb wraps awkwardly, touch targets on click-to-edit are below 44px on some fields. Verified in 2026-04-11 review.
**Fix:** Add a `md:` breakpoint pass to both files. On mobile: SMART fields stack single-column, increase click-target padding to `py-3`, collapse the "Children" and "Linked todos" lists behind expandable section headers when the list is > 3.

### H4. Todo detail still shows duplicate status UI
**File:** `components/todos/todo-detail.tsx`
**Problem:** Status is communicated by both a Badge at the top AND a row of Complete/Skip/Focus buttons. Users can't tell which is authoritative. Flagged as H7 in the 11. 4. 2026 review and still open.
**Fix:** Remove the top Badge. Keep the action buttons (they're reversible, which is correct). Move the "currently complete" signal into the button itself — when completed, the Complete button becomes "Mark incomplete" with an undo glyph.

### H5. SMART fields buried behind "More details"
**File:** `components/goals/goal-form.tsx`
**Problem:** When creating a YEARLY or QUARTERLY goal, the SMART fields (specific/measurable/attainable/relevant/timely) are hidden inside a collapsible. The entire pitch of Ascend's goal model is SMART. Making it optional-looking at creation undermines that.
**Fix:** For YEARLY and QUARTERLY, show SMART fields expanded by default. For MONTHLY and WEEKLY, keep collapsed. This matches the fact that `goal-detail.tsx` also only shows SMART for YEARLY/QUARTERLY.

### H6. Calendar dot indicators have no legend
**File:** `components/calendar/calendar-month-grid.tsx`
**Problem:** Each cell shows up to 3 colored dots: destructive (deadline), amber (Big 3), green (done), muted (pending). There is no legend anywhere. Users have to decode the color grammar from context.
**Fix:** Small inline legend under the month grid title: four colored dots with short labels, same row. Alternative: tooltip on hover over each dot explaining what it represents.

### H7. Keyboard shortcut coverage is incomplete in the reference
**File:** `components/settings/shortcuts-section.tsx`
**Problem:** The visible shortcut reference is missing actions the app supports: `/` for focus search, `c` for new category, `g` for new goal modal, `Shift+?` normalization, bulk selection keys. Users either don't discover them or can't find them documented.
**Fix:** Audit `lib/hooks/use-keyboard-shortcuts.ts` and mirror every registered shortcut into `shortcuts-section.tsx`. Group by context (in-list, navigation, actions, global) as it already does.

### H8. Goal list view drag handle steals from selection affordance
**File:** `components/goals/goal-list-view.tsx:52-63`
**Problem:** Every row shows a `GripVertical` in a 40px cell at all times. It's always visible, always consuming attention. On desktop it's fine; on a dense list it adds noise.
**Fix:** Show the handle only on row hover. Pattern: `opacity-0 group-hover:opacity-100 transition-opacity` on the handle wrapper, `group` class on the row. Keyboard users still have keyboard list navigation via `useListNavigation`.

### H9. Sync indicator label is ambiguous when offline
**File:** `components/layout/sync-indicator.tsx`
**Problem:** When offline, the label is "Offline" in amber. That's correct, but there's no indication of pending writes, no count of queued mutations, and the popover opens to a generic status — the user doesn't know if their last 5 edits are safely queued or lost.
**Fix:** Show `Offline · N queued` when `activeMutations > 0` while offline. Add a warning row to `SyncStatusPopover` when the outbox is non-empty saying "N changes will sync when back online." Note: requires the offline outbox to actually be wired, which the project CLAUDE.md flags as incomplete — so this is a dependency on the offline sync provider being finished first.

---

## 5. Medium-priority improvements

### M1. Settings card header sizing is inconsistent
**File:** `components/settings/api-key-section.tsx` uses `<CardTitle className="text-base">`. Other sections use default CardTitle size. Mixed header weights in the same page.
**Fix:** Remove the override; use default everywhere. Or apply `text-base` consistently across all settings cards — either works, pick one.

### M2. Dashboard hover-lift applied inconsistently
**Files:** Dashboard widgets in `components/dashboard/*-widget.tsx`.
**Problem:** Some widgets use `hover-lift`, some don't. No semantic reason — they're all equally clickable.
**Fix:** Either apply to all widgets whose card surface is clickable, or remove it entirely if the hover lift feels too animated. Pick one policy.

### M3. Theme toggle exists in two places
**Files:** Sidebar footer and `app/(app)/settings/page.tsx` theme section.
**Problem:** Two surfaces for the same control. Settings is the expected location; the sidebar footer version is a convenience that doubles the maintenance.
**Fix:** Keep sidebar footer (it's the more discoverable one). Replace the settings theme section with a read-only "Current theme: X" + link to the sidebar location, OR remove settings entirely. Don't maintain both.

### M4. Focus timer widget positioning
**File:** `components/focus/focus-timer-widget.tsx` + `app/(app)/layout.tsx:35`
**Problem:** Timer widget lives in the footer. For users mid-focus session, the countdown isn't visible when scrolled. Useful as a nudge, not as a persistent timer display.
**Fix:** When a timer is running, escalate to a slim pill on the left side of the footer that's always visible due to the footer being `border-t`. Consider a small toast-like notification 5 minutes before the session ends.

### M5. Morning planning prompt doesn't confirm deselection
**File:** `components/calendar/morning-planning-prompt.tsx:39-45`
**Problem:** Clicking the × on a filled Big 3 slot silently removes the todo. Fine for a single slot, but if all three are set and the user accidentally clicks one, no undo.
**Fix:** Keep the click-to-remove (it's fast), but add a brief toast on removal with an Undo action. Pattern already used elsewhere (`sonner` toasts are in the dep tree).

### M6. Context entry detail tags aren't interactive
**File:** `components/context/context-entry-detail.tsx`
**Problem:** Tag badges are rendered as static Badge components. Clicking a tag should filter the context list to that tag.
**Fix:** Wrap each tag Badge in a button that calls `setContextFilters({ tag: tagName })` on `useUIStore` (or equivalent slice). Same pattern the goals category chip uses.

### M7. Calendar day detail lacks "Plan tomorrow" affordance
**File:** `components/calendar/calendar-day-detail.tsx`
**Problem:** Morning planning is today-only. No way to set tomorrow's Big 3 the night before, which is the most productive time to plan.
**Fix:** Add a "Plan tomorrow" button in the day detail when viewing today. Reuse the morning planning prompt UI with a different save target.

### M8. Dashboard onboarding gate uses different visual language
**File:** `components/dashboard/dashboard-page.tsx` onboarding section.
**Problem:** The onboarding state, contextual hints, and empty welcome card all use slightly different padding and border styles. Not egregious, but reads as multiple surfaces rather than one system.
**Fix:** Unify the card treatment: same rounded radius, same border opacity, same padding. Use the morning-planning card (`border-primary/20 bg-primary/5`) as the template for "attention-needed" cards across the app.

### M9. Goal tree view doesn't show progress inline
**File:** `components/goals/goal-tree-view.tsx`
**Problem:** Tree rows show title + horizon + status, but not progress. For a tree where users are scanning for "what's behind", progress is the most useful signal.
**Fix:** Add a thin 3px progress bar at the bottom of each row, same tokens as `goal-detail.tsx` progress bar. Color by status (green for done, primary for active, muted for blocked).

### M10. Todo bulk bar doesn't persist selection across filter changes
**File:** `components/todos/todo-bulk-bar.tsx`
**Problem:** If a user selects 5 todos, changes the priority filter, the selected IDs may now be hidden. The bulk bar still shows "5 selected" but the selected todos aren't visible.
**Fix:** On filter change, clear selection. Or: surface hidden-but-selected count separately ("5 selected, 3 hidden by filter").

### M11. Command palette doesn't scope results
**File:** `components/command-palette/command-palette.tsx`
**Problem:** Typing in Cmd+K returns a mixed list of goals, todos, and commands without visual separation. Hard to scan.
**Fix:** Add section headers: Goals, Todos, Context, Actions. Limit to top 5 per section. Match pattern of Raycast/Linear palettes.

### M12. Category color chips aren't WCAG-contrast checked
**File:** `components/categories/category-form.tsx` color picker.
**Problem:** Users can pick any color from the palette. Some will fail contrast against the sidebar's light/dark backgrounds, making the category name unreadable.
**Fix:** Compute contrast against both themes at pick time. Warn (don't block) when a color is below AA for normal text.

---

## 6. Low-priority / nitpicks

- **L1.** Footer "Press `?` for shortcuts" hint uses `font-mono text-[0.65rem]` — 10.4px. Consider bumping to `text-xs` (12px) for legibility. `app/(app)/layout.tsx:42-45`.
- **L2.** `BottomTabBar` icons don't show active-route emphasis beyond a color shift. Add a subtle underline or dot under the active tab for faster scanning.
- **L3.** Goal modal's template picker uses the same card visual as the create form. Separating them visually (e.g., templates on a tinted background) would signal "pick or create" faster.
- **L4.** The streak heatmap in todo detail uses 7 columns of squares; on narrow widths (mobile sheet) they compress to illegible 6px cells. Set a min-cell-size of 14px and let it scroll horizontally.
- **L5.** The `+ 0 XP` animated counter on dashboard runs even when XP hasn't changed. Skip the animation when delta is zero.
- **L6.** Confetti on goal completion fires even when the completion is reverting from DONE to IN_PROGRESS and back quickly. Debounce to avoid back-to-back confetti.
- **L7.** `date-fns` European format is mostly applied but `components/calendar/calendar-day-detail.tsx` in one place uses `MMMM d, yyyy` (American). Check and normalize to `d. M. yyyy` or `d MMMM yyyy`.
- **L8.** Skeleton components on dashboard use different heights per widget. Standardize to match the real widget heights so the pre-load layout doesn't shift.
- **L9.** The `GripVertical` handle on goal list rows uses `text-muted-foreground hover:text-foreground` — fine, but the hover contrast in dark mode is too strong. Use `hover:text-muted-foreground/80` for a subtler signal.
- **L10.** `KeyboardShortcuts` dialog (opened with `?`) renders shortcuts in a 2-column grid that wraps awkwardly at narrow widths. Single column below `md:`.
- **L11.** Review page's reflection textareas use `min-h-[100px]` which feels short for reflection. Bump to `min-h-[160px]`.
- **L12.** Settings page doesn't have a "Danger zone" section for account deletion / data wipe. Minor for a single-user app, but a UX expectation.
- **L13.** Sidebar category tree uses a fixed indent per level. For deeply nested categories (>3 levels), horizontal scroll appears. Consider tooltip-based nav above 3 levels instead.
- **L14.** Quick-add inputs don't show a max length indicator. `title` is capped at 200 chars in validations. A subtle counter at 180 chars would prevent silent truncation.
- **L15.** Context entry list doesn't show word count or reading time — useful metadata for long-form notes.

---

## 7. Per-page notes

### /dashboard
**File:** `components/dashboard/dashboard-page.tsx`
- H1 uses `font-serif text-3xl font-bold` — inconsistent with goals/todos/calendar (H1).
- 2-column grid of widgets works well on desktop. On tablet (md: breakpoint) widgets hit an awkward middle where they're neither full-width nor side-by-side.
- Onboarding gate, contextual hints, and welcome empty state use subtly different card treatments (M8).
- `hover-lift` applied unevenly across widgets (M2).
- Big 3 widget is the best-designed widget; the XP/level widget is the weakest because the counter animation competes with the level label.
- Recommend: unify card treatment, consolidate header into single row (already flagged + shipped in H2 per commit log 1d80ade).

### /goals (list + tree + timeline + detail + modal)
**Files:** `components/goals/goal-list-view.tsx`, `goal-tree-view.tsx`, `goal-timeline-view.tsx`, `goal-detail.tsx`, `goal-modal.tsx`, `goal-form.tsx`
- **List:** canonical reference for list patterns. Drag handle always-visible adds noise (H8). Column sorting via TanStack Table is correct. Empty state ("No goals match your filters") is friendly.
- **Tree:** missing inline progress (M9). Otherwise clean, indents are deliberate.
- **Timeline:** Gantt-style, works. Legend for horizon colors is missing. Today line is visible. Zoom levels via `useUIStore.timelineZoom` persist correctly.
- **Detail:** the best page in the app. Click-to-edit, parent breadcrumb, SMART section (YEARLY/QUARTERLY only), progress increment, children list, linked todos, danger zone. This is the template.
- **Modal:** SMART fields collapsed behind "More details" (H5). Template picker visually identical to create form (L3).
- **Filter bar:** canonical (commit cc684dc). Reference implementation.

### /todos (list + filters + detail)
**Files:** `app/(app)/todos/page.tsx`, `components/todos/todo-list-view.tsx`, `todo-filter-bar.tsx`, `todo-detail.tsx`, `todo-bulk-bar.tsx`
- **List:** works. Streak indicator + Big 3 badge render cleanly.
- **Filters:** local state, not Zustand-persisted (C3). Diverges from goals.
- **Detail:** duplicate status UI (H4). Recurring metadata is well-presented with `RepeatIcon` + human-readable rrule. Streak heatmap is a good touch but cramped on mobile (L4).
- **Quick-add:** natural language parser is a quiet win — `"buy milk tomorrow"` parses correctly. No visual signal that parsing happened, though; consider a live preview as the user types.
- **Bulk bar:** selection doesn't survive filter changes (M10).

### /calendar (month + day + morning planning)
**Files:** `components/calendar/calendar-month-grid.tsx`, `calendar-day-detail.tsx`, `morning-planning-prompt.tsx`
- **Month grid:** dot legend missing (H6). Otherwise layout is solid, today highlighted, weekends distinct, clipping clean.
- **Day detail:** mirrors two-panel pattern. Missing "plan tomorrow" (M7). Date format inconsistency in one spot (L7).
- **Morning planning:** best-designed ritual surface. Serif header, primary-tinted card, drag-drop Big 3 picker. Minor: no undo on slot removal (M5).

### /context
**Files:** `components/context/context-entry-detail.tsx`, `context-entry-editor.tsx`, context list page
- Breaks click-to-edit pattern (C2).
- Wikilink navigation stubbed (C2).
- Tags not interactive (M6).
- Markdown rendering via `marked` is fine. Search backed by `search_vector` tsvector is fast.
- List view is sparse — no snippets, no metadata. Feels like a file listing more than a knowledge base.
- Recommend: inline-edit markdown, clickable wikilinks, clickable tags, snippet previews in list.

### /review
**File:** `components/review/weekly-review-page.tsx`
- StatCard pattern with semantic icon colors (green/amber/primary/blue/purple) is readable.
- Collapsible sections work but give no hint of content length before expanding.
- Reflection textareas too short (L11).
- Sticky header is nice on long reviews.
- Missing: a way to browse past reviews. Currently only shows this week.

### /analytics
**Files:** `components/analytics/todo-completion-chart.tsx`, `xp-earned-chart.tsx`, `goal-progress-chart.tsx`
- Chart colors broken (C1).
- Only 3 charts, feels thin (C4).
- No date range picker. Charts show a fixed window.
- Recommend: fix tokens, add 4+ charts, add range control.

### /settings
**Files:** `app/(app)/settings/page.tsx`, `components/settings/*`
- H1 sizing inconsistent (H1).
- Card title sizing inconsistent (M1).
- Theme toggle duplicated with sidebar (M3).
- No danger zone (L12).
- Shortcut reference incomplete (H7).
- Recommend: consolidate, standardize, complete shortcut list.

### Sidebar (nav + category tree + footer widgets)
**Files:** `components/layout/app-sidebar.tsx`, `components/categories/sidebar-category-tree.tsx`, `app/(app)/layout.tsx` footer
- Nav links: clean, active state is clear.
- Category tree: deep nesting causes horizontal scroll (L13).
- Footer: `FocusTimerWidget` + `SyncIndicator` + "? for shortcuts" hint. Text too small (L1). Timer visibility when scrolled is weak (M4).
- Recommend: depth limit on category tree, larger footer text, sticky timer when running.

### Goal modal (create + edit + template picker)
**File:** `components/goals/goal-modal.tsx`, `goal-form.tsx`
- SMART collapsed by default (H5).
- Template picker visually identical to form (L3).
- Parent goal select doesn't show hierarchy — just a flat list. Hard to pick parents in deep trees.
- Recommend: indented parent select, expanded SMART for YEARLY/QUARTERLY, tinted template picker background.

### Todo quick-add (natural language)
**File:** `components/todos/todo-quick-add.tsx`
- No live preview of parsed NL.
- Char count missing (L14).
- Otherwise follows canonical quick-add pattern.
- Recommend: inline preview row below the input showing parsed date/priority/category as chips.

### Focus timer widget
**File:** `components/focus/focus-timer-widget.tsx`
- Popover-triggered. `25/5` and `50/10` presets. Gear for custom durations. `font-mono text-4xl font-bold` countdown inside popover.
- Visibility when scrolled: weak (M4).
- No session history (was focus session completed? when? linked to which todo?).
- Recommend: persistent mini-pill while running, session history linked to todos.

---

## 8. Design system recommendations

### DS1. Treat goals as the reference implementation
Every pattern the app uses exists in polished form in `components/goals/`. The explicit rule: **any new surface must cite the goal component it's modeled on.** No new detail panel unless it can point to `goal-detail.tsx` and justify every divergence. No new filter bar unless it mirrors `goal-filter-bar.tsx`. Enforce via PR template checkbox.

### DS2. Publish a token usage audit
The analytics chart bug (C1) exposes a larger problem: leaf components consume design tokens inconsistently. Audit everywhere `hsl(`, `rgb(`, and raw hex literals appear in components. Replace with Tailwind class names or `var(--color-*)` references. `grep -rn 'hsl(\|rgb(\|#[0-9a-f]\{6\}' components/ | grep -v oklch`.

### DS3. Document the color semantics
The app uses color as signal (amber for Big 3, green for done, destructive for urgent, primary for active, muted for pending). This is never documented. Create `docs/design/colors.md` listing every semantic: what it means, what token to use, examples. Reference from component review PRs.

### DS4. Standardize page headers
Single component: `<PageHeader title actions icon?>` that enforces `font-serif text-2xl font-bold tracking-tight` + right-aligned actions. Replace every h1 in `app/(app)/**/page.tsx` with this component. No more inconsistent sizing.

### DS5. Introduce an EmptyState component
Empty states appear everywhere (no goals, no todos, no context, no morning plan, no search results). Each is written from scratch with a slightly different icon/spacing. Create `components/ui/empty-state.tsx` with props `{ icon, title, description, action? }` and use everywhere.

### DS6. Standardize detail panel skeleton
Abstract the "title row + metadata grid + separator + sections + danger zone" structure into a `<DetailPanel>` layout primitive. Goal detail, todo detail, context detail, (future) category detail should all compose this.

### DS7. Enforce the catalog
`.claude/COMPONENT_CATALOG.md` exists. Reference it in PR template: "Did you check the catalog before creating this component?" Most UI waste in Ascend right now is small variants of things that already exist.

### DS8. Accessibility pass
Run axe or Lighthouse against the 12 surfaces. Expected findings: (a) color-only state indicators on calendar dots, (b) kbd glyphs without aria labels, (c) some hover-only affordances without focus equivalent, (d) detail panel close button likely missing aria-label in some places. Schedule one focused a11y sprint.

### DS9. Motion budget
Hover-lift, view transitions, animated counters, progress bar animations, confetti — individually tasteful, collectively busy. Define a motion budget: at most 2 "big" animations visible in any 1-second window. Add `prefers-reduced-motion` guards everywhere (some exist, not comprehensive).

### DS10. Dark mode parity verification
Dark mode is defined, but not every surface has been verified in both themes at the same reviewer session. After fixing C1 (chart colors), commission a dark-mode-only screenshot pass across all 12 surfaces.

---

## Verification status and next steps

**Verified through Playwright (11. 4. 2026):** core layout integrity, viewport overflow (fixed), button native warnings (fixed), install prompt gating (fixed), horizon filter duplication (fixed), enum label rendering in Select triggers (fixed). Those patches are present in commits `5fee30f`, `1858a72`, `1d80ade`, `cc684dc`, `ad092e7`.

**Not verified in this session:** all findings in this document that involve computed styles, dark-mode parity, chart rendering, hover states, and mobile sheet layout. MCP chrome-devtools tools were not available to run the normal iteration loop (navigate → screenshot → compare → fix → re-verify).

**Recommended next step:** run `ascend-ui-verifier` (the Playwright behavioral agent) against this critique to confirm which findings reproduce in browser, then triage into tickets. Priority order: C1 → C2 → C3 → H1–H4 → C4 → H5–H9 → M1–M12 → L*. DS recommendations are project-wide and should slot in between H and M priorities as design-system debt.

No findings in this critique should be treated as shippable fixes until they've been reproduced in browser. Source-code reading is ground truth for structure; browser verification is ground truth for visual outcome.

---

**End of critique.**
