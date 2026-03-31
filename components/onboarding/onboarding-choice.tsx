"use client";

import { Wand2, Bot, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type OnboardingPath = "wizard" | "mcp" | "skip";

interface OnboardingChoiceProps {
  onSelect: (path: OnboardingPath) => void;
}

const choices: { path: OnboardingPath; icon: typeof Wand2; title: string; description: string }[] = [
  {
    path: "wizard",
    icon: Wand2,
    title: "Guided Setup",
    description: "Walk through creating your first goal step by step",
  },
  {
    path: "mcp",
    icon: Bot,
    title: "AI-Guided Setup",
    description: "Let your AI assistant set up goals through MCP",
  },
  {
    path: "skip",
    icon: ArrowRight,
    title: "Skip for Now",
    description: "Jump into the empty dashboard",
  },
];

export function OnboardingChoice({ onSelect }: OnboardingChoiceProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="font-serif text-3xl font-bold">Welcome to Ascend</h1>
      <p className="mt-2 max-w-md text-center text-muted-foreground">
        Connect your daily actions to yearly ambitions. How would you like to
        get started?
      </p>

      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        {choices.map(({ path, icon: Icon, title, description }) => (
          <button key={path} type="button" onClick={() => onSelect(path)}>
            <Card className="h-full cursor-pointer transition-colors hover:ring-2 hover:ring-primary/50">
              <CardContent className="flex flex-col items-center gap-3 pt-6 pb-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium">{title}</h3>
                <p className="text-xs text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
