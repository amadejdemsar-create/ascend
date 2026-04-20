import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextService } from "@/lib/services/context-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const result = await contextService.getCurrentPriorities(auth.userId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
