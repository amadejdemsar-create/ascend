import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";
import { updateGoalSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const goal = await goalService.getById(auth.userId, id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json(goal);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateGoalSchema.parse(body);
    const goal = await goalService.update(auth.userId, id, data);
    return NextResponse.json(goal);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const goal = await goalService.delete(auth.userId, id);
    return NextResponse.json(goal);
  } catch (error) {
    return handleApiError(error);
  }
}
