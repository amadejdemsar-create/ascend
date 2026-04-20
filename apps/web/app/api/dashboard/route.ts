import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { dashboardService } from "@/lib/services/dashboard-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const data = await dashboardService.getDashboardData(auth.userId);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
