import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";
import { reorderGoalsSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { items } = reorderGoalsSchema.parse(body);
    await goalService.reorderGoals(auth.userId, items);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
