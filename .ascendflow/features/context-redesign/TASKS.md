# Implementation Tasks: Context Redesign

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Schema + validation (DANGER ZONE — audit migration before running)

- [ ] Add `isPinned Boolean @default(false)` to the `ContextEntry` model in `prisma/schema.prisma`. Add `@@index([userId, isPinned])` to the indexes block.
- [ ] Run `npx prisma migrate dev --name add_context_is_pinned --create-only` (NOT without `--create-only`). This generates the migration WITHOUT applying it.
- [ ] **MANDATORY AUDIT:** open the generated `prisma/migrations/<timestamp>_add_context_is_pinned/migration.sql` file and verify it does NOT contain `DROP COLUMN "search_vector"`, `DROP INDEX "ContextEntry_search_vector_idx"`, or any DROP of the `context_entry_search_vector_update` function/trigger. If any destructive SQL is present, remove those statements and append the restoration block from `prisma/migrations/20260414091422_add_focus_sessions/migration.sql` (lines 49-87) to the bottom of the new migration.
- [ ] Apply the migration: `npx prisma migrate deploy` (or `npx prisma migrate dev` once audit confirms it's safe).
- [ ] Run `npx prisma generate` to refresh the client.
- [ ] Add Zod to `lib/validations.ts`: extend `updateContextSchema` or add `togglePinSchema = z.object({ isPinned: z.boolean().optional() })` with exported type `TogglePinInput`.

## Phase 2: Service layer

- [ ] Add `togglePin(userId: string, id: string, isPinned?: boolean)` to `lib/services/context-service.ts`. If `isPinned` is provided, set to that value. Else, flip the current value. Use findFirst with `{ id, userId }` for ownership check. Return the updated entry.
- [ ] Modify `contextService.list` in `lib/services/context-service.ts` to order results by `[{ isPinned: "desc" }, { updatedAt: "desc" }]` so pinned entries sort to the top naturally. Keep the existing category/tag filter behavior intact.

## Phase 3: API routes

- [ ] Create `app/api/context/[id]/pin/route.ts` with `PATCH` handler. Follow the parameterized route pattern from `app/api/todos/[id]/route.ts`. Parse body (may be empty or `{ isPinned }`), call `contextService.togglePin(auth.userId, id, body.isPinned)`, return the updated entry as JSON.

## Phase 4: React Query hooks + Zustand

- [ ] Add to `lib/hooks/use-context.ts`: `useTogglePin()` mutation calling `PATCH /api/context/${id}/pin`. On success, invalidate `queryKeys.context.all()`.
- [ ] Extend `lib/stores/ui-store.ts`: add `contextFilters: { tag?: string }` slice with `setContextTagFilter(tag: string | null)` action. Persist under the existing `partialize`. Bump store version to handle the migration (add another `if (version === X)` branch in the migrate function, initializing `contextFilters: {}`).

## Phase 5: UI — Rewrite the list with rich rows and sections

- [ ] Rewrite `components/context/context-entry-list.tsx`. Remove the flat list. Accept `entries`, `selectedId`, `onSelect`, `isLoading`, `categoryFilter`, `tagFilter`, `onClearTagFilter`, `currentPrioritiesSelected`, `onSelectCurrentPriorities`.

  Internal structure:
  1. Build a helper `stripMarkdown(content)` that removes `#`, `*`, `_`, `[[]]`, backtick fences, links, etc. Take first 120 chars. Add ellipsis if truncated.
  2. Build a `readTime(wordCount)` helper: `Math.max(1, Math.round(wordCount / 200))` minutes.
  3. If a category or tag filter is active, render a flat list of matched entries (with tag filter chip at top showing `"Filtering by #tag × clear"`).
  4. Otherwise, compute sections:
     - Pinned: `entries.filter(e => e.isPinned)`. Show if non-empty.
     - Recent: entries from last 7 days (by `updatedAt`), up to 5, excluding already-pinned.
     - Weekly Reviews: entries with `"weekly-review"` in `tags`. Collapsible `<details>` or `<Collapsible>`, default collapsed. Count in heading. Exclude pinned entries from this bucket.
     - All other: everything else, newest first. Exclude all of the above.
  5. Dynamic entries (Current Priorities) render as a distinct card at the very top with `border-primary/30 bg-primary/5` + "Dynamic · live" badge (pulsing dot). Use existing `onSelectCurrentPriorities` handler.

  Row component (can be internal or split into `ContextEntryRow`):
  ```tsx
  <button
    onClick={() => onSelect(entry.id)}
    className={cn(
      "flex flex-col gap-1.5 w-full rounded-lg border p-3 text-left hover:border-border transition-colors",
      selectedId === entry.id ? "border-primary/30 bg-primary/5" : "border-transparent hover:bg-muted/40",
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        {entry.isPinned && <Pin className="size-3.5 shrink-0 text-amber-500 fill-amber-500" />}
        <span className="text-sm font-medium truncate">{entry.title}</span>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatDistanceToNowStrict(new Date(entry.updatedAt), { addSuffix: true })}
      </span>
    </div>
    <p className="text-xs text-muted-foreground line-clamp-2">
      {stripMarkdown(entry.content)}
    </p>
    <div className="flex items-center gap-1.5 flex-wrap">
      {entry.tags.map((t) => (
        <button
          key={t}
          type="button"
          onClick={(e) => { e.stopPropagation(); onTagClick(t); }}
          className="text-[0.65rem] text-muted-foreground hover:text-primary hover:bg-muted rounded px-1.5 py-0.5"
        >
          #{t}
        </button>
      ))}
      <span className="text-[0.65rem] text-muted-foreground">· {entry.wordCount} words · {readTime} min</span>
    </div>
  </button>
  ```
  Compute `wordCount` on the fly: `entry.content.split(/\s+/).filter(Boolean).length`.

## Phase 6: UI — Context page wiring

- [ ] Edit `app/(app)/context/page.tsx`. Read `useUIStore.contextFilters.tag` and pass to the list. Add `onTagClick(tag)` handler that sets the tag filter. Show a "Clear tag filter" chip when one is active. Filter the `entries` array client-side when a tag filter is set (or extend the `useContextEntries` hook to accept it; client-side filter is simpler). Pass `onTagClick` through to the list.

## Phase 7: UI — Detail panel redesign

- [ ] Refactor `components/context/context-entry-detail.tsx`:
  1. Add a pin button in the header (next to the existing edit and delete icons). Uses `useTogglePin` mutation. Icon: `Pin` from lucide-react with fill when pinned.
  2. Make tag badges clickable → call `useUIStore.setContextTagFilter(tag)` → user sees the list filter to that tag.
  3. Replace the read-only `dangerouslySetInnerHTML` + pencil-to-edit flow with inline edit:
     - Wrap the rendered content in a container that tracks `isEditing` local state
     - When `isEditing === false`: render the markdown HTML (parsed by marked), with wikilinks resolved (see next bullet). Click anywhere in the content → `setIsEditing(true)`.
     - When `isEditing === true`: render a `<textarea>` with the raw markdown content, autoFocus. On blur outside the content container, save via `updateContext.mutateAsync({ id, data: { content: localContent } })`, then `setIsEditing(false)`. On Escape, cancel without saving.
  4. Wikilink resolution: after `marked(content)` produces HTML, post-process the result to replace `[[Title]]` patterns with `<a data-wikilink-id="<id>">Title</a>` by looking up `entry.linkedEntryIds` and matching against the list of entries (fetched via `useContextEntries()` if needed). Unresolved wikilinks → `<span class="text-muted-foreground line-through">Title</span>`. Wire a single click handler on the content container that checks `e.target` for `data-wikilink-id` and calls `onNavigate(id)`.
  5. Add a backlinks section at the bottom:
     ```tsx
     {incomingLinks.length > 0 && (
       <>
         <Separator />
         <div className="space-y-1">
           <Label className="text-xs text-muted-foreground">Referenced in {incomingLinks.length} {incomingLinks.length === 1 ? "entry" : "entries"}</Label>
           {incomingLinks.map((link) => (
             <button
               key={link.id}
               type="button"
               onClick={() => onNavigate?.(link.id)}
               className="flex items-center gap-1.5 text-sm text-primary hover:underline"
             >
               <Link2 className="size-3.5" />
               {link.title}
             </button>
           ))}
         </div>
       </>
     )}
     ```
  6. Keep the dynamic "Current Priorities" branch untouched for now (it has its own data fetch path).

## Phase 8: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Manually verify:
  - Context list shows sections (Pinned, Recent, Weekly Reviews collapsible, All)
  - Rich rows show snippet, word count, clickable tags, updated time
  - Clicking a tag filters the list; clear-chip dismisses
  - Dynamic Current Priorities has distinct tinted card
  - Pin button toggles; pinned entries jump to the Pinned section
  - Clicking on rendered markdown in detail switches to textarea; blur saves
  - Wikilinks `[[Title]]` render as links; clicking navigates
  - Unresolved wikilinks render as muted strikethrough
  - Backlinks section shows at bottom when `incomingLinks.length > 0`
  - Full-text search still works (verify search_vector is still in DB via Prisma Studio or tsvector query)
- [ ] Run `/ax:review` to audit safety rules.
