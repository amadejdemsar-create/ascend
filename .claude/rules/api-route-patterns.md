---
description: API route patterns for all Next.js App Router API endpoints
globs: app/api/**
---

# API Route Patterns

## Standard Route Structure

Every API route follows the same four-step pattern: authenticate, parse, call service, respond.

```typescript
// app/api/<domain>/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { exampleService } from "@/lib/services/example-service";
import { createExampleSchema, exampleFiltersSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);          // 1. Auth
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const filters = exampleFiltersSchema.parse(         // 2. Parse
      Object.fromEntries(searchParams)
    );
    const result = await exampleService.list(            // 3. Service
      auth.userId, filters
    );
    return NextResponse.json(result);                    // 4. Response
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createExampleSchema.parse(body);        // Zod validation
    const result = await exampleService.create(auth.userId, data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Parameterized Routes

For routes with dynamic segments like `[id]`:

```typescript
// app/api/<domain>/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await exampleService.getById(auth.userId, id);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Rules

1. **Always authenticate first.** Every handler starts with `validateApiKey(request)`. Return `unauthorizedResponse()` on failure. No exceptions.

2. **Always validate input with Zod.** POST/PUT/PATCH bodies must be parsed through the appropriate schema from `lib/validations.ts`. GET query params should also be validated when filters are involved.

3. **Never import Prisma in routes.** All database access goes through the service layer. Routes import from `lib/services/`, never from `lib/db`.

4. **Use handleApiError for catch blocks.** It handles `ZodError` (400 with details), regular `Error` (400 with message), and unknown errors (500). Defined in `lib/auth.ts`.

5. **Return 201 for creation.** POST routes that create resources return `{ status: 201 }`.

6. **Return 404 for not found.** When `getById` returns null, respond with `{ error: "Not found" }` and status 404.

## Auth Imports

Everything comes from `lib/auth.ts`:
- `validateApiKey(request)` returns `{ success: true, userId: string }` or `{ success: false }`
- `unauthorizedResponse()` returns a 401 JSON response
- `handleApiError(error)` returns appropriate error responses

## Validation Schemas

All in `lib/validations.ts`. Naming convention:
- `create<Entity>Schema` for POST bodies
- `update<Entity>Schema` for PUT/PATCH bodies (usually `createSchema.partial()` with extra fields)
- `<entity>FiltersSchema` for GET query params
- Types are exported: `Create<Entity>Input`, `Update<Entity>Input`, `<Entity>Filters`
