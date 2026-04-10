import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";
import { bulkCompleteTodosSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { ids } = bulkCompleteTodosSchema.parse(body);
    const results = await todoService.bulkComplete(auth.userId, ids);
    return NextResponse.json(results);
  } catch (error) {
    return handleApiError(error);
  }
}
