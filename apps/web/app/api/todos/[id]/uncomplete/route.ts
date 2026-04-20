import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";

/**
 * Reverse a previously completed todo. Decrements XP, recomputes level,
 * reverses linked goal progress, and decrements the recurring streak if
 * applicable. All steps run inside a single Prisma transaction.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await todoService.uncomplete(auth.userId, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
