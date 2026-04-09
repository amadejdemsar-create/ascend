import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoRecurringService } from "@/lib/services/todo-recurring-service";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const instances = await todoRecurringService.generateDueInstances(auth.userId);
    return NextResponse.json(instances);
  } catch (error) {
    return handleApiError(error);
  }
}
