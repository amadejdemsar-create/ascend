import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { userService } from "@/lib/services/user-service";

export async function PATCH(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    await userService.markOnboardingComplete(auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
