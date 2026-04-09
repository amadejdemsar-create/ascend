import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";

const bulkCompleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { ids } = bulkCompleteSchema.parse(body);
    const results = await todoService.bulkComplete(auth.userId, ids);
    return NextResponse.json(results);
  } catch (error) {
    return handleApiError(error);
  }
}
