import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { reviewService } from "@/lib/services/review-service";
import { saveReviewSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = saveReviewSchema.parse(body);
    const result = await reviewService.saveReview(auth.userId, data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
