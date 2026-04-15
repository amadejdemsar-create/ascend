# Ascend Backlog

Deferred features and initiatives that have been explicitly scoped but not yet implemented. When you want to pick one up, run `/ax:plan <slug>` to create a full PRD + TASKS.md.

Last updated: 15. 4. 2026

---

## Features deferred mid-session

### Sync Offline Outbox (H9 from design critique)

**Slug:** `sync-offline-outbox`
**Deferred because:** Proper implementation requires IndexedDB, a service worker background sync handler, and conflict resolution UI. Multi-session work. The lean F9 sync-status UI (commit `c733290`) surfaces online/offline state and per-domain last-sync times without a real queue.

**Scope when picked up:**
- IndexedDB-backed mutation queue (wraps around all writes in `api-client.ts`)
- Queue persists across page reloads and browser restarts
- Background sync via service worker when connection resumes
- Conflict resolution: server-wins for v1, detail panel warning banner for v2
- `SyncIndicator` popover shows "N queued changes" with per-change inspect
- Error handling: failed mutations stay in the queue with retry + exponential backoff
- Toasts: "1 change queued" / "5 changes syncing" / "All changes saved"

**Touches:**
- `lib/api-client.ts` — wrap mutation path in queue-first handler
- `public/sw.js` — background sync event handler
- New `lib/offline/outbox.ts` — IndexedDB abstraction (idb or dexie)
- `lib/hooks/use-sync-status.ts` — expose queued count
- `components/layout/sync-status-popover.tsx` — render queued items

**Dependencies:**
- Decide on IndexedDB library: `idb` (zero-dep wrapper) or raw IndexedDB API.
- Schema version for the outbox store.

---

## Design system work deferred

### DS6 — DetailPanel primitive

**Slug:** `detail-panel-primitive`
**Deferred because:** Refactor across `goal-detail`, `todo-detail`, `context-entry-detail`, and `calendar-day-detail`. Each has an ad-hoc version of "title + metadata + separator + sections + danger zone". Extracting shared layout requires careful prop API design and regression testing. Solid afternoon's work.

**Scope when picked up:**
- `components/ui/detail-panel.tsx` with slots: `header`, `metadata`, `sections`, `dangerZone`
- Handles mobile Sheet fallback internally
- Close button, back button (mobile), loading skeleton all built in
- Migrate all 4 detail panels one at a time with a VERIFY step between each

### DS8 — Accessibility pass (axe + Lighthouse)

**Slug:** `accessibility-pass`
**Deferred because:** Requires running axe and Lighthouse across 12 surfaces, triaging findings, and executing fixes. Expected findings: color-only state indicators, `<kbd>` without aria-label, hover-only affordances without focus equivalent, some icon buttons missing aria-label, detail panel close button aria-label in some places. One focused sprint (4-8 hours).

**Scope when picked up:**
- Run axe-core against every `/app/(app)/**` page (scripted via `axe-playwright`)
- Run Lighthouse mobile + desktop per surface
- Fix high-severity findings in one PR per surface
- Add a `docs/accessibility-checklist.md` to keep future changes compliant

### DS10 — Dark mode parity sweep

**Slug:** `dark-mode-parity`
**Deferred because:** Requires manual walkthrough of 12 surfaces in dark theme, screenshot, and fix contrast/token issues surface by surface. Especially important after C1 fix migrated chart colors to oklch tokens.

**Scope when picked up:**
- Screenshot every surface in dark mode (Playwright-driven)
- Audit for: text contrast, icon visibility, border visibility, surface elevation
- Fix any hardcoded colors missed by the C1 sweep
- Commit the screenshots as a baseline in `.ascendflow/visual-regression/dark/`

---

## Feature ideas (not yet scoped)

These aren't committed priorities; they're seeds for future roadmaps.

### Push notifications

- Morning Big 3 reminder at a user-configured time
- Deadline warnings (48h and 24h before)
- Streak-at-risk alerts ("You'll break your 14-day streak if you skip today")
- PWA already supports the Notification API; needs a permission request flow, server-side scheduling (cron or a service), and user preferences in Settings.

### Claude API-powered natural language parsing

- Fallback for the heuristic parser in F7 when confidence is low
- "Parse with AI" button on the todo quick-add input
- Sends the raw input to Claude API with a structured output schema (OpenAI-style tool call or Anthropic's structured outputs)
- Env variable `ANTHROPIC_API_KEY` required
- Cost: ~$0.002 per call with Haiku; could be toggled per-user or rate-limited

### Habit streak heatmap on dashboard

- F4 added the heatmap on recurring todo detail. A condensed version (last 28 days, all habits stacked) could live on the dashboard as a 6th widget.

### Goal timeline integration with calendar

- Goal deadlines are already displayed on the calendar. Extend: show goal start dates as ranges, color-coded by horizon.

### Export-to-markdown for context entries

- Single-click export for context entries as `.md` files with YAML frontmatter (tags, dates, backlinks)
- Useful for Obsidian / Logseq users who want to sync Ascend context to their main vault
