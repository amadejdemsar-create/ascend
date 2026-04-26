import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextMapService } from "@/lib/services/context-map-service";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const map = await contextMapService.getCurrent(auth.userId);
    if (!map) {
      return NextResponse.json(
        { error: "No map yet" },
        { status: 404 },
      );
    }
    return NextResponse.json(map);
  } catch (error) {
    return handleApiError(error);
  }
}
