import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";

const reorderTodosSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(200),
});

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
