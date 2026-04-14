import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  unauthorizedResponse,
  handleApiError,
} from "@/lib/auth";
import { analyticsService } from "@/lib/services/analytics-service";
import { analyticsQuerySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const query = analyticsQuerySchema.parse(
      Object.fromEntries(searchParams),
    );
    const data = await analyticsService.getTrends(auth.userId, query.weeks);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
