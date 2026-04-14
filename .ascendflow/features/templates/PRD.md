# Templates

**Slug**: templates
**Created**: 14. 4. 2026
**Status**: planning

## Problem

A new user (or an experienced one facing a blank form) has to write every goal and todo from scratch. The blank-page problem reduces engagement: staring at an empty "Specific" field is friction, not clarity. Templates give the user a concrete starting point that they can adapt, removing the cognitive load of inventing structure. This is particularly valuable for SMART goals (a Yearly goal with all 5 SMART fields properly filled is a 5-minute exercise most users skip) and for repeating ritual todos (morning routine, weekly review checklist).

## User Story

As a user, I want to pick from curated goal and todo templates when creating new items so that I have a concrete starting point instead of a blank form.

## Success Criteria

- [ ] A "Use a template" button at the top of the goal modal. Clicking it opens a template picker dialog.
- [ ] 6 curated goal templates covering common scenarios: Launch a product, Learn a skill, Fitness goal, Save money target, Build a habit, Read N books
- [ ] Each template pre-fills: title, horizon, priority, description, and all 5 SMART fields (for YEARLY/QUARTERLY horizons) with example placeholder-like values the user can edit
- [ ] A "Use a template" option in the todo quick-add area (small icon button next to the add button)
- [ ] 5 curated todo templates: Morning routine, Evening wind-down, Weekly review checklist, Project kickoff, Deep work session
- [ ] Each todo template creates ONE todo (or a small batch of 3-5 todos for checklists) using the template's title and default priority
- [ ] Templates are hardcoded constants (not user-editable in v1, but architecture allows adding DB-backed custom templates later)
- [ ] Template picker has a clear cancel action; dismissing leaves the form unchanged

## Affected Layers

- **Prisma schema**: none
- **Service layer**: none (templates are client-side constants; they call the existing createGoal / createTodo hooks)
- **API routes**: none
- **React Query hooks**: none
- **UI components**: new `lib/templates/goal-templates.ts`, new `lib/templates/todo-templates.ts`, new `components/templates/template-picker-dialog.tsx`, modified `components/goals/goal-modal.tsx`, modified `components/goals/goal-form.tsx` (accept initialData from template), modified `components/todos/todo-quick-add.tsx`
- **MCP tools**: none
- **Zustand store**: none (template state is local to the picker dialog)

## Data Model Changes

None. Templates are in-memory constants. Applying a template pre-fills the existing create forms and calls the existing mutations.

## Template Shape

```ts
// lib/templates/goal-templates.ts
export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  horizon: "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY";
  priority: "LOW" | "MEDIUM" | "HIGH";
  data: {
    title: string;
    description?: string;
    specific?: string;
    measurable?: string;
    attainable?: string;
    relevant?: string;
    timely?: string;
    targetValue?: number;
    unit?: string;
  };
}

// lib/templates/todo-templates.ts
export interface TodoTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  todos: Array<{
    title: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    description?: string;
  }>;
}
```

## UI Flows

### Goal template picker
1. User clicks "New Goal" → goal modal opens
2. A small "Use a template" link/button appears at the top of the modal (above the form)
3. Clicking it replaces the form area with a template picker: 6 cards in a 2-column grid, each showing icon, name, one-line description
4. User clicks a template → the template's data is applied to the form state, picker closes, form shows pre-filled fields
5. User can still edit any field before saving

### Todo template picker
1. Small template icon button next to the todo quick-add's "+ Add" button
2. Clicking it opens a dialog with 5 template cards
3. User picks one → creates the todo(s) immediately via the existing `useCreateTodo` mutation, shows success toast
4. Multi-item templates (like "Morning routine") create all todos in parallel using `Promise.all(templates.todos.map(t => createTodo.mutateAsync(t)))`

## Cache Invalidation

Templates are client-side constants with no cache. Applying a template triggers existing mutations, which already handle invalidation.

## Danger Zones Touched

None. Templates are a thin layer over existing create flows.

## Out of Scope

- User-created custom templates (deferred to a future feature with DB backing)
- Editing templates in the UI
- Template categories / tags / search
- Sharing templates between users
- Template import/export
- Weekly review templates (the `/review` page already has structured prompts)
- MCP tool for creating from template (can be added later by exposing the constants)

## Open Questions

None. Template content (exact copy for each of the 11 templates) will be written during implementation to match the app's tone.
