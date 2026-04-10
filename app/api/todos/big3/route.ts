import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";
import { setBig3Schema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const big3 = await todoService.getBig3(
      auth.userId,
      dateParam ? new Date(dateParam) : undefined,
    );
    return NextResponse.json(big3);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { todoIds, date } = setBig3Schema.parse(body);
    const big3 = await todoService.setBig3(
      auth.userId,
      todoIds,
      date ? new Date(date) : undefined,
    );
    return NextResponse.json(big3);
  } catch (error) {
    return handleApiError(error);
  }
}
