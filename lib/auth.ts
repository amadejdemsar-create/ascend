import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/lib/services/user-service";
import { ZodError } from "zod";

type AuthResult =
  | { success: true; userId: string }
  | { success: false };

export async function validateApiKey(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false };
  }

  const apiKey = authHeader.slice(7); // Remove "Bearer " prefix
  const user = await userService.findByApiKey(apiKey);

  if (!user) {
    return { success: false };
  }

  return { success: true, userId: user.id };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.issues },
      { status: 400 }
    );
  }
  if (error instanceof Error) {
    // Service layer errors (e.g., hierarchy validation, not found)
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
