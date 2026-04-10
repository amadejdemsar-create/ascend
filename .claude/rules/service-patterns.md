---
description: Service layer patterns for all database operations and business logic
globs: lib/services/**
---

# Service Layer Patterns

## Structure

Every service is a const object with async methods exported from `lib/services/<domain>-service.ts`. The `userId` parameter is always first.

```typescript
// lib/services/example-service.ts
import { prisma } from "@/lib/db";
import type { CreateExampleInput, UpdateExampleInput } from "@/lib/validations";

export const exampleService = {
  async list(userId: string, filters?: ExampleFilters) {
    return prisma.example.findMany({
      where: { userId, ...filterConditions },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { category: true },
    });
  },

  async getById(userId: string, id: string) {
    return prisma.example.findFirst({
      where: { id, userId },
      include: { category: true },
    });
  },

  async create(userId: string, data: CreateExampleInput) {
    return prisma.example.create({
      data: { ...data, userId },
    });
  },

  async update(userId: string, id: string, data: UpdateExampleInput) {
    const existing = await prisma.example.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Not found");
    return prisma.example.update({ where: { id }, data });
  },

  async delete(userId: string, id: string) {
    const existing = await prisma.example.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Not found");
    return prisma.example.delete({ where: { id } });
  },
};
```

## Rules

1. **userId in every query.** Every `findMany`, `findFirst`, `findUnique`, `update`, and `delete` MUST include `userId` in the `where` clause. This is the multi-tenant boundary.

2. **Validate before mutating.** For update and delete, always check the record exists and belongs to the user before mutating. Use `findFirst` with `{ id, userId }`, throw `new Error("Not found")` if missing.

3. **Type inputs from validations.** Import input types from `lib/validations.ts` (e.g., `CreateGoalInput`, `UpdateTodoInput`). Never use `any` or `Record<string, unknown>` for service method parameters.

4. **Keep Prisma imports in services only.** No other layer (routes, components, hooks, MCP handlers) should import from `@/lib/db` or `@prisma/client`. The service layer is the only place Prisma is called.

5. **Date conversion.** Zod schemas parse dates as ISO strings. Convert to `Date` objects before passing to Prisma: `new Date(data.startDate)`.

6. **Hierarchy validation.** For goals with `parentId`, call `validateHierarchy()` from `lib/services/hierarchy-helpers.ts` before creating or updating.

7. **Error pattern.** Throw plain `Error` instances with descriptive messages. The route layer catches these via `handleApiError()` from `lib/auth.ts` and returns 400 responses.

## Existing Services

| Service | File | Domain |
|---------|------|--------|
| goalService | `lib/services/goal-service.ts` | Goals CRUD, search, completion |
| todoService | `lib/services/todo-service.ts` | Todos CRUD, Big 3, completion |
| contextService | `lib/services/context-service.ts` | Context entries CRUD, search |
| categoryService | `lib/services/category-service.ts` | Categories CRUD, tree |
| dashboardService | `lib/services/dashboard-service.ts` | Dashboard aggregation |
| gamificationService | `lib/services/gamification-service.ts` | XP, levels, streaks |
| recurringService | `lib/services/recurring-service.ts` | Goal recurrence |
| todoRecurringService | `lib/services/todo-recurring-service.ts` | Todo recurrence (rrule) |
| exportService | `lib/services/export-service.ts` | JSON, CSV, DOCX export |
