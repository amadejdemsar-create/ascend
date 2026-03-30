import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { categoryService } from "@/lib/services/category-service";
import { updateCategorySchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const category = await categoryService.getById(auth.userId, id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(category);
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
    const data = updateCategorySchema.parse(body);
    const category = await categoryService.update(auth.userId, id, data);
    return NextResponse.json(category);
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
    const category = await categoryService.delete(auth.userId, id);
    return NextResponse.json(category);
  } catch (error) {
    return handleApiError(error);
  }
}
