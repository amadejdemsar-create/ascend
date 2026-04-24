# Ascend Backlog

Deferred features and initiatives that have been explicitly scoped but not yet implemented. When you want to pick one up, run `/ax:plan <slug>` to create a full PRD + TASKS.md.

Last updated: 24. 4. 2026

---

## Wave 1 (Graph Foundation) — SHIPPED 24. 4. 2026

The 15-day plan collapsed into a single focused session: monorepo package `@ascend/graph`, typed `ContextLink` edges, 7 entry types, extended wikilink syntax, graph view (ReactFlow + d3-force), detail panel edges section, Quick Link dialog, entry type selector, Backlinks view, 7 new MCP graph tools. Production now reports 47 MCP tools (40 existing + 7 new). Commits `f36d8a2`, `f684ef5`, `22c9929`, `d86b53c`, `29bf523`, `fa21884`, `2970512`, `fb60017`, `21302ad`. Close-out at `.ascendflow/features/context-v2/wave-1-graph-foundation/CLOSE-OUT.md`.

## Wave 1 → Wave 2+ carry-overs (tracked here until picked up)

- **Performance benchmark on 500-node graphs.** Phase 8.9 was not formally executed; `computeLayout` was verified only with a synthetic 500-node graph during Phase 2 (637ms layout). The graph view (`context-graph-view.tsx`) target is <2s cold / <200ms warm on a 500-entry real database. Seed a 500-entry fixture in a future session and measure.
- **ax:verify-ui on the graph view.** Phase 8.8 listed a UI scenario plan (graph rendering, focus mode, filter chips, inline type change, Quick Link dialog, edit [[relation:X]] → new edge). Deferred to a follow-up ax:verify-ui pass because the session is already long.
- **Optional composite unique `(fromEntryId, toEntryId, type, userId)` on ContextLink.** Today the composite unique is `(fromEntryId, toEntryId, type)`; `userId` enforcement lives in the application layer. Schema-level multi-tenant enforcement would require a migration. Non-blocking.
- **Defense-in-depth userId in the ContextLink upsert where.** The upsert in `contextLinkService.create` and `syncContentLinks` uses the composite unique as its where target; userId scoping is the preceding ownership check rather than part of the constraint. Safe by construction today.
- **Persisted graph layouts.** Current graph layout is computed on every mount via d3-force. For large graphs, caching positions on the server (or in IndexedDB on the client) would give instant re-open. Nice-to-have for Wave 3+.
- **Mobile graph renderer.** `@ascend/graph` is platform-agnostic but ReactFlow is web-only. Wave 6 Expo needs a native renderer (react-native-skia + custom edge/node components) consuming the same `computeLayout` output. Deferred as planned.
- **`getGraph` node cap "degree" currently uses cross-user degree for defense-in-depth `_count` filter.** The `_count.select.outgoingLinks.where: { userId }` was added in Wave 1 Phase 3. Revisit for efficiency if count queries get slow on large graphs.
- **Reporting accuracy: `syncContentLinks.created` overcounts on no-op upserts.** The counter increments unconditionally; when the parser re-encounters an unchanged CONTENT link, the upsert is a no-op but the counter ticks. Not a correctness issue, only observability.

---

## Wave 0 (Platform Foundation) — SHIPPED 22. 4. 2026

The monorepo conversion + shared packages + token auth + presigned upload scaffolding + Lexical spike shipped as 10 commits (3339d4e → 3bda502 → close commit). PRD at `.ascendflow/features/context-v2/wave-0-platform-foundation/PRD.md`. Close-out at `.ascendflow/features/context-v2/wave-0-platform-foundation/CLOSE-OUT.md`.

**DZ-5 resolved.** The duplicated `fetchJson` helper that lived in `use-goals.ts`, `use-todos.ts`, `use-context.ts`, `use-categories.ts`, and `use-dashboard.ts` is collapsed into `@ascend/api-client`. The danger zone is retired from the active list; it is retained in `CLAUDE.md` as historical context only.

## Wave 0 → Wave 8+ carry-overs (tracked here until picked up)

- **Orphan file upload rows.** `apps/web/lib/services/file-service.ts` creates a PENDING `File` row on every `/api/files/presign` call. If the client never uploads, the row persists forever. Wave 8 should add a cron job that deletes PENDING rows older than 24 hours and reconciles R2 objects against the DB.
- **Per-user file storage quota.** Phase 7 enforces per-file size (100 MiB) and MIME allowlist, but no aggregate quota per user. Wave 8 multi-tenant should add a quota.
- **Rate limiting on `/api/files/*` and other write routes.** Phase 6 added login rate limiting only. Wave 8 should add broader rate limiting per authenticated user.
- **SVG XSS gating for file-serving endpoint.** Phase 7 kept `image/svg+xml` in the upload allowlist with a documented gating requirement: when a file-serving endpoint is built, it MUST either drop SVG, sanitize server-side, or serve with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`. See comment in `packages/core/src/schemas/files.ts`.
- **Distributed login rate limiter (Redis).** The in-process `Map` in `authService` works for single-node. Multi-node deployments need Redis. Interface is already Redis-ready; swap when the deployment topology changes.
- **Cookie options shared constant.** `apps/web/middleware.ts` duplicates `buildClearCookieOptions()` because the edge runtime can't import Node's `crypto`. Extract to a shared edge-safe constant in `@ascend/core` in a future cleanup pass so the two locations can't drift.
- **Migrate remaining bare `fetch()` in `apps/web/lib/hooks/use-dashboard.ts`.** Two fire-and-forget recurring-generation triggers still bypass the 401 interceptor. Low risk, but worth migrating to `apiFetch` in a future cleanup pass.

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
