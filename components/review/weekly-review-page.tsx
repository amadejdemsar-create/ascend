"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  Zap,
  Star,
  ChevronDown,
  ClipboardCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { useSaveReview } from "@/lib/hooks/use-review";
import type { WeeklyReviewData } from "@/lib/services/review-service";
import type { LucideIcon } from "lucide-react";

// --- Props ---

interface WeeklyReviewPageProps {
  data: WeeklyReviewData | undefined;
  isLoading: boolean;
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
}

// --- Helpers ---

function formatEuropeanDate(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${d}. ${m}. ${y}`;
}

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  return formatEuropeanDate(date);
}

// --- Stat Card ---

interface StatCardProps {
  icon: LucideIcon;
  iconClass: string;
  value: string | number;
  label: string;
}

function StatCard({ icon: Icon, iconClass, value, label }: StatCardProps) {
  return (
    <Card size="sm" className="hover-lift">
      <CardContent className="flex flex-col gap-1">
        <Icon className={`size-4 ${iconClass}`} />
        <p className="font-mono text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

// --- Section Header (Collapsible) ---

interface SectionHeaderProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

function CollapsibleSection({ title, count, children }: SectionHeaderProps) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:text-foreground transition-colors">
        <span>
          {title} ({count})
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

// --- Loading Skeleton ---

function ReviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Week selector skeleton */}
      <div className="flex items-center justify-center gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Section skeletons */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Empty State ---

function EmptyWeek() {
  return (
    <EmptyState
      icon={ClipboardCheck}
      title="No activity recorded for this week."
      description="Complete some todos or make progress on goals to populate your review."
    />
  );
}

// --- Main Component ---

export function WeeklyReviewPage({
  data,
  isLoading,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
}: WeeklyReviewPageProps) {
  const [wentWell, setWentWell] = useState("");
  const [toImprove, setToImprove] = useState("");
  const saveReview = useSaveReview();

  const weekEnd = addDays(weekStart, 6);

  async function handleSave() {
    const trimmedWell = wentWell.trim();
    const trimmedImprove = toImprove.trim();
    if (!trimmedWell && !trimmedImprove) {
      toast.error("Please write at least one reflection before saving.");
      return;
    }
    try {
      await saveReview.mutateAsync({
        weekStart: format(weekStart, "yyyy-MM-dd"),
        wentWell: trimmedWell,
        toImprove: trimmedImprove,
      });
      toast.success("Review saved to Context");
      setWentWell("");
      setToImprove("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save review",
      );
    }
  }

  const isEmpty =
    data &&
    data.completedTodos.length === 0 &&
    data.carriedOverTodos.length === 0 &&
    data.completedGoals.length === 0 &&
    data.goalProgressDeltas.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background p-4">
        <PageHeader title="Weekly Review" className="mb-0" />
      </div>

      <div className="p-4 max-w-3xl mx-auto w-full space-y-6">
        {/* Week selector */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium px-2">
            {formatEuropeanDate(weekStart)} to {formatEuropeanDate(weekEnd)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextWeek}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onThisWeek}>
            This Week
          </Button>
        </div>

        {isLoading ? (
          <ReviewSkeleton />
        ) : isEmpty ? (
          <EmptyWeek />
        ) : data ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                icon={CheckCircle2}
                iconClass="text-green-500"
                value={data.stats.todosCompleted}
                label="Todos completed"
              />
              <StatCard
                icon={Clock}
                iconClass="text-amber-500"
                value={data.stats.todosCarriedOver}
                label="Todos carried over"
              />
              <StatCard
                icon={Target}
                iconClass="text-primary"
                value={data.stats.goalsCompleted}
                label="Goals completed"
              />
              <StatCard
                icon={TrendingUp}
                iconClass="text-blue-500"
                value={data.stats.goalsProgressed}
                label="Goals progressed"
              />
              <StatCard
                icon={Zap}
                iconClass="text-purple-500"
                value={data.stats.xpEarned}
                label="XP earned"
              />
              <StatCard
                icon={Star}
                iconClass="text-amber-500"
                value={`${data.stats.big3Days}/7 days`}
                label="Big 3 hit rate"
              />
            </div>

            <Separator />

            {/* Completed section */}
            {(data.completedTodos.length > 0 ||
              data.completedGoals.length > 0) && (
              <CollapsibleSection
                title="Completed"
                count={
                  data.completedTodos.length + data.completedGoals.length
                }
              >
                {/* Completed todos */}
                {data.completedTodos.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {data.completedTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                        <span className="flex-1 truncate">{todo.title}</span>
                        {todo.goal && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {todo.goal.title}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed goals */}
                {data.completedGoals.length > 0 && (
                  <div className="space-y-1 mt-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3">
                      Goals
                    </p>
                    {data.completedGoals.map((goal) => (
                      <div
                        key={goal.id}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Target className="size-4 text-primary shrink-0" />
                        <span className="flex-1 truncate">{goal.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {goal.horizon.charAt(0) +
                            goal.horizon.slice(1).toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            )}

            {/* Carried Over section */}
            {data.carriedOverTodos.length > 0 && (
              <CollapsibleSection
                title="Carried Over"
                count={data.carriedOverTodos.length}
              >
                <div className="space-y-1 mt-2">
                  {data.carriedOverTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <Clock className="size-4 text-amber-500 shrink-0" />
                      <span className="flex-1 truncate">{todo.title}</span>
                      <GoalPriorityBadge
                        priority={
                          todo.priority as "LOW" | "MEDIUM" | "HIGH"
                        }
                      />
                      {todo.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          {formatDueDate(todo.dueDate)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Goal Progress section */}
            {data.goalProgressDeltas.length > 0 && (
              <>
                <Separator />
                <CollapsibleSection
                  title="Goal Progress"
                  count={data.goalProgressDeltas.length}
                >
                  <div className="space-y-3 mt-2">
                    {data.goalProgressDeltas.map((goal) => (
                      <div key={goal.id} className="space-y-1 px-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate font-medium">
                            {goal.title}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {goal.progressStart}% &rarr; {goal.progressEnd}%{" "}
                            <span
                              className={
                                goal.delta > 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }
                            >
                              ({goal.delta > 0 ? "+" : ""}
                              {goal.delta}%)
                            </span>
                          </span>
                        </div>
                        {/* Mini progress bar */}
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, goal.progressEnd))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </>
            )}

            <Separator />

            {/* Reflection section */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Reflections</h2>

              <div className="space-y-2">
                <label
                  htmlFor="went-well"
                  className="text-sm text-muted-foreground"
                >
                  What went well this week?
                </label>
                <Textarea
                  id="went-well"
                  placeholder="Celebrate your wins, note what worked, and identify patterns worth repeating..."
                  value={wentWell}
                  onChange={(e) => setWentWell(e.target.value)}
                  rows={4}
                  className="min-h-[160px]"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="to-improve"
                  className="text-sm text-muted-foreground"
                >
                  What to improve next week?
                </label>
                <Textarea
                  id="to-improve"
                  placeholder="Identify blockers, adjust priorities, or note habits to change..."
                  value={toImprove}
                  onChange={(e) => setToImprove(e.target.value)}
                  rows={4}
                  className="min-h-[160px]"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saveReview.isPending}
                className="w-full sm:w-auto"
              >
                {saveReview.isPending ? "Saving..." : "Save Review to Context"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
