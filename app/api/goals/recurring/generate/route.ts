import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalRecurringService } from "@/lib/services/goal-recurring-service";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const instances = await goalRecurringService.generateDueInstances(auth.userId);
    return NextResponse.json({
      count: instances.length,
      instances,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
