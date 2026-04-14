# Implementation Tasks: Natural Language Quick-Add

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Parser module

- [ ] Create `lib/natural-language/parser.ts`. Export `ParsedTodo`, `ParserContext`, and `parseNaturalLanguage(input, context)` function.

  The parser runs in order, extracting tokens and stripping them from the working title:

  1. **Big 3**: Match regex `/(^|\s)\*big3(\s|$)/i`. Set `isBig3 = true`. Remove the match from the title.

  2. **Recurring**: Match regex patterns. Set `isRecurring = true` and `recurringFrequency`:
     - `/\bdaily\b/i` or `/\bevery day\b/i` → DAILY
     - `/\bweekly\b/i` or `/\bevery week\b/i` or `/\bevery (mon|tue|wed|thu|fri|sat|sun)\w*\b/i` → WEEKLY
     - `/\bmonthly\b/i` or `/\bevery month\b/i` → MONTHLY

  3. **Date**: Try in order, first match wins:
     - `/\btoday\b/i` → today at end of day
     - `/\btomorrow\b/i` → tomorrow at end of day
     - `/\bnext week\b/i` → next Monday at end of day
     - `/\bin (\d+) days?\b/i` → today + N days
     - `/\b(mon|tue|wed|thu|fri|sat|sun)\w*\b/i` → next occurrence of that weekday
     - `/\b(\d{1,2})\.\s*(\d{1,2})\.(\s*(\d{4}))?\b/` (D. M. or D. M. YYYY) → that date. If year missing, use current year; if the date is in the past, roll to next year.
     Set `dueDate` as ISO string.

  4. **Priority**: 
     - `/\b!?high\b/i` or `/!!!/` or `/\burgent\b/i` → HIGH
     - `/\b!?medium\b/i` or `/!!/` → MEDIUM
     - `/\b!?low\b/i` or `/!(\s|$)/` → LOW (note `!` followed by space or end)

  5. **Goal link**: `/#([a-z0-9_-]+)/gi` — extract each match, look up `context.goals` for one whose title's kebab-case version starts with the match. Take the first match (not all), set `goalId` and `goalTitle`.

  6. **Category link**: `/@([a-z0-9_-]+)/gi` — similar fuzzy match against `context.categories` by name (case-insensitive, kebab-compare).

  7. **Clean up**: after stripping, collapse multiple spaces into one, trim. The remaining string is the `title`.

  Each match pushes `{ token, type, value }` to `matches` for the preview UI to display and to support token-removal.

  Helper: include `dateFnsAdapter` or similar using `date-fns` for weekday math (`nextMonday`, `nextTuesday`, etc.). Use `endOfDay` so due dates set to end of the day.

## Phase 2: Preview chips component

- [ ] Create `components/todos/parsed-preview.tsx`. Props: `{ parsed: ParsedTodo; onRemoveToken: (type: string) => void }`. Renders a horizontal row of chips:
  - Date chip: CalendarDays icon + formatted date + X button
  - Priority chip: colored Badge + priority label + X
  - Goal chip: Target icon + goal title + X
  - Category chip: colored dot + category name + X
  - Big 3 chip: Star icon + "Big 3" + X
  - Recurring chip: Repeat icon + frequency + X
  
  If `parsed.matches.length === 0`, render nothing.
  
  The X button calls `onRemoveToken(type)` which the parent uses to strip the token from the input.

## Phase 3: Wire into quick-add

- [ ] Edit `components/todos/todo-quick-add.tsx`:
  1. Add imports: `useGoals` from `@/lib/hooks/use-goals`, `useCategories` from `@/lib/hooks/use-categories`, `parseNaturalLanguage` from `@/lib/natural-language/parser`, `ParsedPreview` from `./parsed-preview`, `useMemo` from React.
  2. Fetch goals and categories:
     ```ts
     const { data: rawGoals } = useGoals();
     const { data: rawCategories } = useCategories();
     const goals = useMemo(() => (rawGoals ?? []).map((g) => ({ id: g.id, title: g.title })), [rawGoals]);
     // categories is a tree; flatten for the parser
     const categories = useMemo(() => flattenCategories(rawCategories ?? []), [rawCategories]);
     ```
  3. Compute parsed result:
     ```ts
     const parsed = useMemo(() => parseNaturalLanguage(title, { goals, categories }), [title, goals, categories]);
     ```
  4. Update `handleCreate` to use parsed fields as overrides on the existing priority/default:
     ```ts
     await createTodo.mutateAsync({
       title: parsed.title.trim() || trimmed,
       priority: parsed.priority ?? priority as "LOW" | "MEDIUM" | "HIGH",
       ...(parsed.dueDate && { dueDate: parsed.dueDate }),
       ...(parsed.goalId && { goalId: parsed.goalId }),
       ...(parsed.categoryId && { categoryId: parsed.categoryId }),
       ...(parsed.isBig3 && { isBig3: true }),
     });
     ```
     Note: the `Todo` schema accepts these fields; verify against `lib/validations.ts` `createTodoSchema`.
  5. Render `<ParsedPreview>` below the input. Pass `parsed` and `onRemoveToken` (which removes the matching token text from the input string).

## Phase 4: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Manually verify: typing `"Buy groceries tomorrow !high"` shows a preview with date and priority chips, title becomes "Buy groceries" after parse. Enter creates the todo.
- [ ] Manually verify: typing `"Meditation daily *big3"` parses recurring and Big 3. Creates a recurring todo.
- [ ] Manually verify: typing `"Research competitors #launch-product"` matches goal if one exists with title starting "Launch product".
- [ ] Run `/ax:review` for safety audit.
