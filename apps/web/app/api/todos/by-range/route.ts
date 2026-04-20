import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";
import { dateRangeQuerySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const { start, end } = dateRangeQuerySchema.parse({
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });
    const todos = await todoService.getByDateRange(auth.userId, start, end);
    return NextResponse.json(todos);
  } catch (error) {
    return handleApiError(error);
  }
}
