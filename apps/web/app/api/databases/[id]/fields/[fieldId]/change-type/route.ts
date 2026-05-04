import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { databaseFieldService } from "@/lib/services/database-field-service";
import { databaseFieldTypeSchema } from "@/lib/validations";
import { z } from "zod";

const changeTypeBodySchema = z.object({
  newType: databaseFieldTypeSchema,
  force: z.boolean().optional(),
});

/**
 * POST /api/databases/[id]/fields/[fieldId]/change-type
 *
 * Change a field's type with optional forced coercion. Returns the updated
 * field on success or { ok: false, offendingRowIds } if validation fails
 * and force is not set.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { fieldId } = await params;
    const body = await request.json();
    const data = changeTypeBodySchema.parse(body);
    const result = await databaseFieldService.changeType(auth.userId, fieldId, data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
