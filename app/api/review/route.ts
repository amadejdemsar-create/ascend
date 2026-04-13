import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { reviewService } from "@/lib/services/review-service";
import { weeklyReviewQuerySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const query = weeklyReviewQuerySchema.parse(
      Object.fromEntries(searchParams),
    );
    const data = await reviewService.getWeeklyReview(
      auth.userId,
      query.weekStart,
    );
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
