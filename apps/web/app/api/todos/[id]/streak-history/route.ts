import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoRecurringService } from "@/lib/services/todo-recurring-service";
import { streakHistoryQuerySchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = streakHistoryQuerySchema.parse(
      Object.fromEntries(searchParams)
    );
    const data = await todoRecurringService.getCompletionHistory(
      auth.userId,
      id,
      query.days
    );
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
