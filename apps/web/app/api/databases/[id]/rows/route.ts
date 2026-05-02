import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseRowService } from "@/lib/services/database-row-service";
import { databaseQueryService } from "@/lib/services/database-query-service";
import {
  createDatabaseRowSchema,
  filterSchema,
  sortSchema,
} from "@/lib/validations";
import { z } from "zod";

/** Inline schema for pagination query params */
const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  perPage: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 200))
    .pipe(z.number().int().min(1).max(500)),
});

/**
 * GET /api/databases/[id]/rows
 *
 * Query rows with optional filter, sort, and pagination.
 * Query params:
 *   viewId?  - cuid of a saved view
 *   filter?  - JSON-stringified filter object
 *   sort?    - JSON-stringified sort array
 *   page?    - int >= 1, default 1
 *   perPage? - int 1..500, default 200
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id: databaseId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse pagination
    const { page, perPage } = paginationSchema.parse({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    });

    // Parse optional viewId
    const viewId = searchParams.get("viewId") ?? undefined;

    // Parse optional filter (JSON-encoded string)
    let filter: z.infer<typeof filterSchema> | undefined;
    const filterRaw = searchParams.get("filter");
    if (filterRaw) {
      const parsed = JSON.parse(decodeURIComponent(filterRaw));
      filter = filterSchema.parse(parsed);
    }

    // Parse optional sort (JSON-encoded string)
    let sort: z.infer<typeof sortSchema> | undefined;
    const sortRaw = searchParams.get("sort");
    if (sortRaw) {
      const parsed = JSON.parse(decodeURIComponent(sortRaw));
      sort = sortSchema.parse(parsed);
    }

    const result = await databaseQueryService.query(auth.userId, databaseId, {
      viewId,
      filter,
      sort,
      page,
      perPage,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/databases/[id]/rows
 *
 * Create a new row in the database. Body: { properties? }.
 * Returns the new row (201).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id: databaseId } = await params;
    const body = await request.json();
    const data = createDatabaseRowSchema.parse(body);
    const result = await databaseRowService.create(
      auth.userId,
      databaseId,
      data.properties,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
