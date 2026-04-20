import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { focusService } from "@/lib/services/focus-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const todoId = searchParams.get("todoId");
    const goalId = searchParams.get("goalId");
    if (todoId) {
      return NextResponse.json(
        await focusService.summaryForTodo(auth.userId, todoId),
      );
    }
    if (goalId) {
      return NextResponse.json(
        await focusService.summaryForGoal(auth.userId, goalId),
      );
    }
    return NextResponse.json(await focusService.summaryForWeek(auth.userId));
  } catch (error) {
    return handleApiError(error);
  }
}
