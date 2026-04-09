import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing required query parameters: start and end" },
        { status: 400 },
      );
    }

    const goals = await goalService.getByDeadlineRange(
      auth.userId,
      new Date(start),
      new Date(end),
    );
    return NextResponse.json(goals);
  } catch (error) {
    return handleApiError(error);
  }
}
