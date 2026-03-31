import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";
import { categoryService } from "@/lib/services/category-service";
import { isOldTodosFormat, migrateOldFormat, HORIZON_ORDER } from "@/lib/services/import-helpers";
import type { CreateGoalInput } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();

    // Detect and migrate old format
    let importData: {
      goals: Array<Record<string, unknown>>;
      categories: Array<Record<string, unknown>>;
    };

    if (isOldTodosFormat(body)) {
      importData = migrateOldFormat(body);
    } else {
      importData = {
        goals: (body.goals ?? []) as Array<Record<string, unknown>>,
        categories: (body.categories ?? []) as Array<Record<string, unknown>>,
      };
    }

    const errors: string[] = [];
    let categoriesCreated = 0;
    let goalsCreated = 0;
    const categoryIdMap = new Map<string, string>();
    const goalIdMap = new Map<string, string>();

    // Import categories first
    for (const cat of importData.categories) {
      try {
        const created = await categoryService.create(auth.userId, {
          name: String(cat.name),
          color: (cat.color as string) ?? "#4F46E5",
          icon: cat.icon as string | undefined,
        });
        if (cat.id) {
          categoryIdMap.set(String(cat.id), created.id);
        }
        categoriesCreated++;
      } catch (err) {
        errors.push(`Category "${cat.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Sort goals by horizon so parents exist before children
    const sortedGoals = [...importData.goals].sort((a, b) => {
      const aIdx = HORIZON_ORDER.indexOf(a.horizon as typeof HORIZON_ORDER[number]);
      const bIdx = HORIZON_ORDER.indexOf(b.horizon as typeof HORIZON_ORDER[number]);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    // Import goals
    for (const goal of sortedGoals) {
      try {
        const mappedCategoryId = goal.categoryId
          ? categoryIdMap.get(String(goal.categoryId)) ?? undefined
          : undefined;
        const mappedParentId = goal.parentId
          ? goalIdMap.get(String(goal.parentId)) ?? undefined
          : undefined;

        const goalData: CreateGoalInput = {
          title: String(goal.title ?? "Untitled"),
          horizon: (goal.horizon as "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY") ?? "WEEKLY",
          priority: (goal.priority as "LOW" | "MEDIUM" | "HIGH") ?? "MEDIUM",
          description: goal.description as string | undefined,
          categoryId: mappedCategoryId,
          parentId: mappedParentId,
          notes: goal.notes as string | undefined,
          deadline: goal.deadline as string | undefined,
          startDate: goal.startDate as string | undefined,
          targetValue: goal.targetValue as number | undefined,
          unit: goal.unit as string | undefined,
          specific: goal.specific as string | undefined,
          measurable: goal.measurable as string | undefined,
          attainable: goal.attainable as string | undefined,
          relevant: goal.relevant as string | undefined,
          timely: goal.timely as string | undefined,
        };

        const created = await goalService.create(auth.userId, goalData);
        if (goal.id) {
          goalIdMap.set(String(goal.id), created.id);
        }
        goalsCreated++;
      } catch (err) {
        errors.push(`Goal "${goal.title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      categoriesCreated,
      goalsCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
