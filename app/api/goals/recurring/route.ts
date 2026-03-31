import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { recurringService } from "@/lib/services/recurring-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const templates = await recurringService.listTemplates(auth.userId);
    return NextResponse.json(templates);
  } catch (error) {
    return handleApiError(error);
  }
}
