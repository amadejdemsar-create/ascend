import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { userService } from "@/lib/services/user-service";
import { updateAiSettingsSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const settings = await userService.getSettings(auth.userId);
    if (!settings) {
      // No settings row yet; return defaults
      return NextResponse.json({
        chatProvider: "GEMINI",
        chatModel: null,
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = updateAiSettingsSchema.parse(body);
    const updated = await userService.updateAiSettings(auth.userId, data);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
