import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/lib/services/user-service";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const user = await userService.findById(auth.userId);
    if (!user) {
      // Stale cookie or API key pointing to a deleted user.
      return unauthorizedResponse();
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
