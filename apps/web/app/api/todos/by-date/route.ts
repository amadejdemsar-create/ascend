import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";
import { dateQuerySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const { date } = dateQuerySchema.parse({ date: searchParams.get("date") });
    const todos = await todoService.getByDate(auth.userId, date);
    return NextResponse.json(todos);
  } catch (error) {
    return handleApiError(error);
  }
}
