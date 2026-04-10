import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";
import { reorderTodosSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { items } = reorderTodosSchema.parse(body);
    await todoService.reorder(auth.userId, items);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
