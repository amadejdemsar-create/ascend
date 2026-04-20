"use client";

import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CategoryProgress } from "@/lib/services/dashboard-service";

interface ProgressOverviewWidgetProps {
  categories: CategoryProgress[];
}

export function ProgressOverviewWidget({
  categories,
}: ProgressOverviewWidgetProps) {
  const sorted = [...categories].sort((a, b) => b.percentage - a.percentage);

  return (
    <Card className="hover-lift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          Progress Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Assign goals to categories to see progress breakdown.
            </p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/goals" />}>
              Assign categories
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((cat) => (
              <div key={cat.categoryId} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {cat.completed}/{cat.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all progress-bar-animated"
                    style={{
                      backgroundColor: cat.color,
                      width: `${cat.percentage}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
