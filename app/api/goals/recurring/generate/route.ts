import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { recurringService } from "@/lib/services/recurring-service";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const instances = await recurringService.generateDueInstances(auth.userId);
    return NextResponse.json({
      count: instances.length,
      instances,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
