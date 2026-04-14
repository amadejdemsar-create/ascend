# Natural Language Quick-Add

**Slug**: natural-language-quick-add
**Created**: 14. 4. 2026
**Status**: planning

## Problem

The todo quick-add currently requires clicking priority, picking a horizon, and typing the title separately. Power users want to type in natural language ("Buy groceries tomorrow high priority for meal prep goal") and have Ascend parse the intent into structured data. This is the keyboard-native flow that makes capturing todos frictionless.

## Decision: client-side heuristics (not Claude API)

The parser is pure client-side regex-and-keyword matching. Reasoning:
1. Fast (no network latency, no 300-800ms wait)
2. Works offline, always
3. No API cost per quick-add
4. No extra env setup (Anthropic API key)
5. Patterns people use are predictable enough for heuristics to cover 80%+ of cases
6. User's own data (goals, categories) becomes the dictionary for matches

A Claude-API-powered "smart parse" fallback can be added later as a separate feature if heuristics prove insufficient.

## User Story

As a user, I want to type todos in natural language ("Buy groceries tomorrow high priority for meal prep") and have Ascend parse the date, priority, and linked goal automatically so that capturing todos feels instant.

## Success Criteria

- [ ] The todo quick-add input parses keywords as the user types and shows a live preview of the parsed structured data (badges below the input)
- [ ] Parsed fields: title (remaining text after keyword extraction), dueDate, priority, goalId, categoryId, isBig3, isRecurring
- [ ] Date keywords supported: "today", "tomorrow", "mon/tue/wed/thu/fri/sat/sun" (next occurrence), "next week" (next Monday), "in N days", "D. M." (European), "D. M. YYYY"
- [ ] Priority keywords: "high" / "!high" / "!!!" / "urgent", "medium" / "!medium" / "!!", "low" / "!low" / "!" 
- [ ] Goal link: `#<goal-title-prefix>` — fuzzy matches against the user's goals
- [ ] Category link: `@<category-name>` — matches the user's categories
- [ ] Big 3 flag: `*big3` or `*priority` (lowercase word "big3" prefixed with a star)
- [ ] Recurring: "every day" / "daily", "every monday" / "weekly", "every month" / "monthly"
- [ ] Preview chips are clickable: clicking a chip removes that parsed token from the title and clears the field
- [ ] Submitting creates the todo with the parsed fields via the existing `useCreateTodo` mutation
- [ ] Fallback: if nothing parses, the input works exactly like the current quick-add (just title + default priority)

## Affected Layers

- **Prisma schema**: none
- **Service layer**: none
- **API routes**: none
- **React Query hooks**: reads from `useGoals()` and `useCategories()` to build the dictionary for goal/category matching
- **UI components**: new `lib/natural-language/parser.ts`, new `components/todos/parsed-preview.tsx` (the chip row), modified `components/todos/todo-quick-add.tsx`
- **MCP tools**: none
- **Zustand store**: none

## Data Model Changes

None.

## Parser Contract

```ts
// lib/natural-language/parser.ts

export interface ParsedTodo {
  title: string; // cleaned of all keywords
  dueDate?: string; // ISO date string
  priority?: "LOW" | "MEDIUM" | "HIGH";
  goalId?: string;
  goalTitle?: string; // for preview display
  categoryId?: string;
  categoryName?: string;
  isBig3?: boolean;
  isRecurring?: boolean;
  recurringFrequency?: "DAILY" | "WEEKLY" | "MONTHLY";
  matches: Array<{ token: string; type: "date" | "priority" | "goal" | "category" | "big3" | "recurring"; value: unknown }>;
}

export interface ParserContext {
  goals: Array<{ id: string; title: string }>;
  categories: Array<{ id: string; name: string }>;
  now?: Date; // defaults to new Date(), injectable for tests
}

export function parseNaturalLanguage(input: string, context: ParserContext): ParsedTodo;
```

## UI Flows

**Todo quick-add** (`components/todos/todo-quick-add.tsx`):

1. Current behavior preserved: Enter creates the todo with whatever is parsed
2. As the user types, the parser runs on every change (debounced 100ms)
3. Below the input, a chip row appears showing the parsed fields:
   - Date chip: "Due 15. 4. 2026" (x button to clear)
   - Priority chip: "High" (colored red for high, amber for medium, blue for low)
   - Goal chip: "→ Launch product" (with link icon)
   - Category chip: "Fitness" (with category color dot)
   - Big 3 chip: "⭐ Big 3"
   - Recurring chip: "↻ Daily"
4. Clicking a chip's x button removes that token from the title AND clears the parsed field
5. Pressing Enter creates the todo with the parsed fields; the existing priority Select is ignored if parser found a priority (override hint shown)

**Preview example:**
- Input: `"Buy groceries tomorrow !high for meal prep"`
- Parsed title: `"Buy groceries for meal prep"` (tomorrow and !high removed)
- Wait, `for meal prep` should be `#meal-prep` to match a goal. Let me restrict: `"for X"` does NOT trigger goal lookup (too ambiguous); only `#X` and `@X` do. That keeps the parser predictable.
- Revised: `"Buy groceries tomorrow !high #meal-prep"` → title "Buy groceries", due tomorrow, priority HIGH, goalId for "meal prep"

## Cache Invalidation

None from the parser itself (read-only). The create mutation already invalidates correctly.

## Danger Zones Touched

None. Pure client-side parsing over existing data.

## Out of Scope

- Claude API-powered parsing (defer to a future feature)
- Parsing for goals (goal modal stays form-based)
- Parsing deadlines as free-text ("by end of week") — only explicit keywords
- Natural language in other languages (English only)
- Voice input
- Autocomplete dropdown for goal/category names

## Open Questions

None. Heuristic rules above are explicit.
