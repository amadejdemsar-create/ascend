# Context Redesign

**Slug**: context-redesign
**Created**: 14. 4. 2026
**Status**: planning

## Problem

The /context page is supposed to be Ascend's AI memory: a structured knowledge base for operating principles, current priorities, weekly reviews (F3 now saves them here), meeting notes, and reference material. But it reads as a flat file listing. Every entry looks the same regardless of whether it's the auto-generated "Current Priorities", a pinned principle, a weekly review, or a one-off note. There are no snippets, no word counts, no visible structure, and the detail panel breaks the app's click-to-edit pattern (markdown is read-only; editing requires a pencil button that opens a separate editor). Design critique called this out as C2. Backlinks already exist in the data layer (`incomingLinks` is returned by `contextService.getById`) but are not rendered. Wikilinks are stubbed to a toast.

The result: a user with 20+ entries cannot answer "what did I write recently?", "what's pinned?", or "what's linked to this?" without scanning manually.

## User Story

As a user, I want the context page to feel like a real knowledge base with clear structure, inline editing, and working wikilinks/backlinks so that I can navigate, write, and connect my notes the same way I navigate my goals and todos.

## Scope

Three coordinated waves shipped as one feature:

1. **Wave A — Rich list previews.** Each entry row shows a snippet, word count, read time, pin indicator, clickable tags.
2. **Wave B — Smart list sections.** Pinned / Recent (last 7 days) / Weekly Reviews (auto-grouped by tag) / By Category / Everything else.
3. **Wave C — Inline editing + backlinks.** Click content to edit. Wikilinks `[[X]]` resolve to clicks. Backlinks panel at bottom of detail. Clickable tags filter.

## Success Criteria

- [ ] New `ContextEntry.isPinned` boolean field with migration `add_context_is_pinned`
- [ ] `contextService.togglePin(userId, id)` method + `PATCH /api/context/:id/pin` route
- [ ] List rows show: title, 120-char snippet of stripped markdown content, tags (clickable), word count, relative updated time, pin icon
- [ ] List is organized into sections (when no category filter): Pinned (if any), Recent (last 7 days, up to 5), Weekly Reviews (collapsible, entries tagged `weekly-review`), All (everything else)
- [ ] When a category filter is active: flat list with just the filtered entries, no sections
- [ ] Dynamic entries (Current Priorities) render with a distinctive tinted card background and a "Dynamic · live" badge
- [ ] Clicking any tag on any entry sets a tag filter in the Zustand UI store; list filters to entries containing that tag; clear-tag chip appears at top of list
- [ ] Detail panel: click anywhere in the rendered markdown → switches to a textarea with the raw markdown. Blur outside → saves via `updateContext` mutation, re-renders markdown.
- [ ] Wikilinks `[[Title]]` in rendered markdown resolve to `<a>` elements that call `onNavigate(entry.id)` (entry IDs are already in `linkedEntryIds`). Unresolved wikilinks (title not matched) render as muted text with no link.
- [ ] Tag badges in the detail header are clickable → add that tag to the UI store filter
- [ ] Backlinks panel at the bottom of the detail: "Referenced in N entries" with clickable entry titles. Uses `incomingLinks` which `contextService.getById` already returns.
- [ ] Pin/unpin button in the detail header (next to edit and delete)
- [ ] Pinning an entry moves it to the Pinned section immediately (optimistic update + invalidation)

## Affected Layers

- **Prisma schema**: add `isPinned Boolean @default(false)` + `@@index([userId, isPinned])` to ContextEntry
- **Service layer**: `lib/services/context-service.ts` (add `togglePin`, extend `list` sorting to prioritize pinned)
- **API routes**: new `app/api/context/[id]/pin/route.ts` (PATCH)
- **React Query hooks**: `lib/hooks/use-context.ts` (add `useTogglePin`, extend `useContextEntries` filter type if needed for tag filtering)
- **UI components**: rewrite `components/context/context-entry-list.tsx` (rich rows + sections), refactor `components/context/context-entry-detail.tsx` (inline edit, backlinks, clickable tags, pin button, wikilink resolution), modify `app/(app)/context/page.tsx` (tag filter bar + filter chip)
- **MCP tools**: none new; existing `list_context` / `get_context` / `set_context` are sufficient (pinning is UI-only)
- **Zustand store**: new `contextFilters: { tag?: string }` slice in `lib/stores/ui-store.ts` with persistence

## Data Model Changes

```prisma
model ContextEntry {
  // existing fields unchanged
  isPinned Boolean @default(false)

  // existing indexes plus:
  @@index([userId, isPinned])
}
```

Migration: `add_context_is_pinned`. CRITICAL: the migration file MUST be manually reviewed before `prisma migrate dev` is run, to confirm it does NOT contain DROP statements for `search_vector`, the GIN index, or the trigger function. If `prisma migrate dev` produces destructive SQL (as it did during F8), append restoration SQL for `search_vector` following the pattern in `prisma/migrations/20260414091422_add_focus_sessions/migration.sql`.

## API Contract

### PATCH /api/context/[id]/pin

Toggles the `isPinned` flag on the entry.

Request body: `{}` (optional) or `{ isPinned: boolean }` for explicit set. Default: toggle.
Response: updated entry object, status 200.

## UI Flows

### List organization

When no filter is active (no category, no tag):

```
[Search bar]
[Categories collapsible tree]
──────────────────────────

📌 Pinned                 (n)
   [row] [row] [row]

🕒 Recent                 (last 7 days)
   [row] [row]

📚 Weekly Reviews         (n) ▼     collapsible, default collapsed
   [row] [row] [row]

📁 All other              (everything else, newest first)
   [row] [row] [row]
```

When category filter is active: show only the filtered entries as a flat list with no section headers (avoid empty sections).

When tag filter is active: show a tag chip at the top ("Filtering by #weekly-review ×") and a flat list of matching entries.

### Row shape

```
[📌?] Title                              2d ago
      First 120 characters of stripped
      markdown content that preview...
      #tag1  #tag2  · 340 words · 2 min
```

The pin icon appears only if pinned. Tags are clickable buttons that set the UI store tag filter. Clicking elsewhere on the row opens the detail.

### Dynamic entry styling

The "Current Priorities" dynamic entry uses `border-primary/30 bg-primary/5` card treatment and a small "Dynamic · live" badge with a pulsing dot to distinguish it from user-created entries.

### Detail panel

```
← [breadcrumb if any]
Title                     [pin] [edit hint] [delete]
#tag1  #tag2  (clickable)

[Rendered markdown / click-to-edit]
  Wikilinks [[Title]] render as underlined links.
  Unresolved wikilinks render as muted strikethrough text.

──────────────────────────

Referenced in 3 entries:
  → Weekly Review: 7. 4. — 13. 4. 2026
  → Meeting notes: pricing
  → Operating Principles
```

Click the content → textarea replaces it, the entry title becomes "Editing...". Blur outside (but not on toolbar) → saves + renders. Escape → cancels without saving.

## Cache Invalidation

- `useTogglePin.onSuccess` invalidates `queryKeys.context.all()`
- `updateContext` already invalidates context queries; no changes there
- Tag filter updates are Zustand (no React Query invalidation needed)

## Danger Zones Touched

**Context search_vector not in Prisma schema** (CLAUDE.md safety rule 6). The migration MUST be audited before running. If Prisma tries to drop the column, follow the restoration SQL pattern from `prisma/migrations/20260414091422_add_focus_sessions/migration.sql`.

**Client-side markdown editing requires careful cursor handling.** The inline edit pattern must not blow away user cursor position on save. Use a controlled `<textarea>` with `onBlur` save, not a contentEditable div.

## Out of Scope

- Markdown toolbar (bold / italic / headings buttons)
- Live markdown preview while editing (just raw textarea while editing, rendered on blur)
- Rich text features (tables, code blocks styling beyond marked's defaults)
- Backlink preview tooltips (only clickable titles)
- Drag-and-drop reordering of pinned entries
- Keyboard shortcut `c` for quick capture (defer to a future keyboard pass)
- Command palette integration (defer)
- Exporting entries to markdown files (already possible via export service, no UI changes)

## Open Questions

None. The data layer already supports everything needed (linkedEntryIds exists, incomingLinks is computed, parseBacklinks is wired). This is primarily a UI + small schema addition (isPinned).
