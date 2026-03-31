"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryColorPicker } from "@/components/categories/category-color-picker";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

interface OnboardingWizardProps {
  onComplete: () => void;
}

type WizardStep = 0 | 1 | 2 | 3 | 4;

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Category state
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#4F46E5");
  const [createdCategoryId, setCreatedCategoryId] = useState<string | null>(null);

  // Step 2: Yearly goal state
  const [yearlyTitle, setYearlyTitle] = useState("");
  const [yearlyDescription, setYearlyDescription] = useState("");
  const [createdYearlyId, setCreatedYearlyId] = useState<string | null>(null);

  // Step 3: Quarterly goal state
  const [quarterlyTitle, setQuarterlyTitle] = useState("");
  const [quarterlyDescription, setQuarterlyDescription] = useState("");

  async function handleCreateCategory() {
    if (!categoryName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await fetchJson<{ id: string }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryName.trim(), color: categoryColor }),
      });
      setCreatedCategoryId(result.id);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateYearlyGoal() {
    if (!yearlyTitle.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await fetchJson<{ id: string }>("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          title: yearlyTitle.trim(),
          description: yearlyDescription.trim() || undefined,
          horizon: "YEARLY",
          categoryId: createdCategoryId ?? undefined,
        }),
      });
      setCreatedYearlyId(result.id);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateQuarterlyGoal() {
    if (!quarterlyTitle.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await fetchJson("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          title: quarterlyTitle.trim(),
          description: quarterlyDescription.trim() || undefined,
          horizon: "QUARTERLY",
          parentId: createdYearlyId ?? undefined,
          categoryId: createdCategoryId ?? undefined,
        }),
      });
      setStep(4);
      // Celebrate
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        disableForReducedMotion: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setIsSubmitting(false);
    }
  }

  const steps = [
    { title: "Welcome", subtitle: "How Ascend works" },
    { title: "Create a Category", subtitle: "Organize your goals by area of life" },
    { title: "Set a Yearly Goal", subtitle: "Your big ambition for the year" },
    { title: "Break It Down", subtitle: "Create a quarterly milestone" },
    { title: "All Set!", subtitle: "You are ready to go" },
  ];

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i <= step ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      <Card className="w-full max-w-lg">
        <CardContent className="pt-6 pb-6">
          <h2 className="font-serif text-xl font-bold">{steps[step].title}</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {steps[step].subtitle}
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Ascend connects your daily actions to yearly ambitions through a
                four-level hierarchy:
              </p>
              <div className="space-y-2 rounded-md bg-muted/50 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Yearly</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">Quarterly</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">Monthly</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">Weekly</span>
                </div>
                <p className="text-xs">
                  Each goal nests inside its parent, so completing weekly tasks
                  rolls up into quarterly and yearly progress.
                </p>
              </div>
              <p>
                You will create a category, a yearly goal, and a quarterly
                sub-goal to see the full flow.
              </p>
            </div>
          )}

          {/* Step 1: Create category */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onboard-cat-name">Category Name</Label>
                <Input
                  id="onboard-cat-name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Health, Career, Learning"
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <CategoryColorPicker
                  value={categoryColor}
                  onChange={setCategoryColor}
                />
              </div>
            </div>
          )}

          {/* Step 2: Create yearly goal */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                Category:{" "}
                <span
                  className="inline-block h-3 w-3 rounded-full align-middle"
                  style={{ backgroundColor: categoryColor }}
                />{" "}
                <span className="font-medium text-foreground">
                  {categoryName}
                </span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-yearly-title">Goal Title</Label>
                <Input
                  id="onboard-yearly-title"
                  value={yearlyTitle}
                  onChange={(e) => setYearlyTitle(e.target.value)}
                  placeholder="e.g. Run a marathon, Learn Spanish"
                  maxLength={200}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-yearly-desc">
                  Description (optional)
                </Label>
                <Textarea
                  id="onboard-yearly-desc"
                  value={yearlyDescription}
                  onChange={(e) => setYearlyDescription(e.target.value)}
                  placeholder="Why is this goal important to you?"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: Create quarterly sub-goal */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                Parent goal:{" "}
                <span className="font-medium text-foreground">
                  {yearlyTitle}
                </span>{" "}
                (Yearly)
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-quarterly-title">
                  Quarterly Milestone
                </Label>
                <Input
                  id="onboard-quarterly-title"
                  value={quarterlyTitle}
                  onChange={(e) => setQuarterlyTitle(e.target.value)}
                  placeholder="e.g. Run 10K in under 50 minutes"
                  maxLength={200}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-quarterly-desc">
                  Description (optional)
                </Label>
                <Textarea
                  id="onboard-quarterly-desc"
                  value={quarterlyDescription}
                  onChange={(e) => setQuarterlyDescription(e.target.value)}
                  placeholder="What will this quarterly milestone achieve?"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                You have created a category, a yearly goal, and a quarterly
                milestone. You can now add monthly and weekly goals to keep
                building your hierarchy.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            {step > 0 && step < 4 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((step - 1) as WizardStep)}
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step === 0 && (
              <Button size="sm" onClick={() => setStep(1)}>
                Get Started
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}

            {step === 1 && (
              <Button
                size="sm"
                onClick={handleCreateCategory}
                disabled={!categoryName.trim() || isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Category"}
                {!isSubmitting && <ArrowRight className="ml-1 h-4 w-4" />}
              </Button>
            )}

            {step === 2 && (
              <Button
                size="sm"
                onClick={handleCreateYearlyGoal}
                disabled={!yearlyTitle.trim() || isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Goal"}
                {!isSubmitting && <ArrowRight className="ml-1 h-4 w-4" />}
              </Button>
            )}

            {step === 3 && (
              <Button
                size="sm"
                onClick={handleCreateQuarterlyGoal}
                disabled={!quarterlyTitle.trim() || isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Milestone"}
                {!isSubmitting && <Check className="ml-1 h-4 w-4" />}
              </Button>
            )}

            {step === 4 && (
              <Button size="sm" onClick={onComplete}>
                Go to Dashboard
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
