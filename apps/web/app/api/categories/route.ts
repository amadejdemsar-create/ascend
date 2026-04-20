import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { categoryService } from "@/lib/services/category-service";
import { createCategorySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const tree = await categoryService.listTree(auth.userId);
    return NextResponse.json(tree);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createCategorySchema.parse(body);
    const category = await categoryService.create(auth.userId, data);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
