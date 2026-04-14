# Implementation Tasks: Templates

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Template constants

- [ ] Create `lib/templates/goal-templates.ts`. Export `GoalTemplate` interface (see PRD). Export `GOAL_TEMPLATES: GoalTemplate[]` with 6 entries:
  1. **Launch a product** (QUARTERLY, HIGH) — SMART fields describe shipping a v1 release
  2. **Learn a new skill** (QUARTERLY, MEDIUM) — SMART fields describe mastering a technical or personal skill over 90 days
  3. **Fitness goal** (QUARTERLY, MEDIUM) — SMART fields describe a measurable fitness target (e.g., running 5k, strength, consistency)
  4. **Save money target** (YEARLY, HIGH) — SMART fields with targetValue and unit (EUR)
  5. **Build a daily habit** (MONTHLY, MEDIUM) — shorter duration, focus on consistency
  6. **Read N books** (YEARLY, LOW) — with targetValue (12) and unit ("books")
  
  Each template's SMART fields should be concrete starter examples like: "Ship v1 to 100 beta users by 30. 6. 2026" for `timely`, "50 active paying users" for `measurable`, etc. Users should feel the template is a real example they can customize, not abstract filler.

- [ ] Create `lib/templates/todo-templates.ts`. Export `TodoTemplate` interface. Export `TODO_TEMPLATES: TodoTemplate[]` with 5 entries:
  1. **Morning routine** — 4 todos (Hydrate, 10 min meditation, Review today's Big 3, 30 min focused work)
  2. **Evening wind-down** — 3 todos (Reflect on today, Plan tomorrow, 15 min read)
  3. **Weekly review** — 4 todos (Complete /review page, Archive done goals, Plan next week's Big 3, Journal one insight)
  4. **Project kickoff** — 5 todos (Write one-paragraph brief, Identify first 3 milestones, Create tracking goal, Schedule deep work block, Share with accountability partner)
  5. **Deep work session** — 1 todo (2 hours focused work, no meetings, phone off)

## Phase 2: Template picker dialog component

- [ ] Create `components/templates/template-picker-dialog.tsx`. Props:
  ```ts
  interface Props<T> {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templates: T[];
    title: string;
    description: string;
    onPick: (template: T) => void;
  }
  ```
  Uses `Dialog` from `@/components/ui/dialog`. Renders a 2-column grid of `Card` items. Each card shows the template's icon (use `DynamicIcon` from `lucide-react/dynamic`), name (font-medium), and description (text-xs muted). Click a card → calls `onPick(template)` → closes dialog.
  
  Include `T extends { id: string; name: string; description: string; icon: string }` generic constraint.

## Phase 3: Wire into goal modal

- [ ] Edit `components/goals/goal-modal.tsx`. Add state for the template picker open/closed. Above the `<GoalForm>` inside the dialog content, add:
  ```tsx
  <button onClick={() => setTemplatePickerOpen(true)} className="text-xs text-primary hover:underline">
    Use a template
  </button>
  ```
  When a template is picked, call the existing `useUIStore.setGoalEditData()` OR extend `GoalForm` to accept a `templateData` prop that merges into initial state. Simpler: set local state `appliedTemplate` and pass it as `initialData` alongside `goalEditData`.
  
  Import `TemplatePickerDialog` and `GOAL_TEMPLATES` from their new files.

- [ ] Verify `components/goals/goal-form.tsx` already uses `initialData` prop correctly (it does). No changes needed there — the modal passes pre-filled data via the existing prop.

## Phase 4: Wire into todo quick-add

- [ ] Edit `components/todos/todo-quick-add.tsx`. Add a small `LayoutTemplate` icon button (from `lucide-react`) between the horizon/priority select and the "+ Add" button. Clicking it opens `TemplatePickerDialog` with `TODO_TEMPLATES`.
  
  When a template is picked:
  ```ts
  await Promise.all(
    template.todos.map((t) => 
      createTodo.mutateAsync({ title: t.title, priority: t.priority, ...(t.description && { description: t.description }) })
    )
  );
  toast.success(`Created ${template.todos.length} todos from "${template.name}"`);
  ```
  
  Use the existing `useCreateTodo()` mutation.

## Phase 5: Verification

- [ ] Run `npx tsc --noEmit`. Must pass with zero errors.
- [ ] Run `npm run build`. Must pass with zero errors.
- [ ] Manually verify: opening Goal modal shows "Use a template" link; clicking it opens the picker; picking "Launch a product" pre-fills title, horizon, priority, and SMART fields.
- [ ] Manually verify: todo quick-add shows template icon; picking "Morning routine" creates 4 todos.
- [ ] Run `/ax:review` to audit for safety rules.
