import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json(
        { error: "Missing required query parameter: date" },
        { status: 400 },
      );
    }

    const todos = await todoService.getByDate(auth.userId, new Date(dateParam));
    return NextResponse.json(todos);
  } catch (error) {
    return handleApiError(error);
  }
}
