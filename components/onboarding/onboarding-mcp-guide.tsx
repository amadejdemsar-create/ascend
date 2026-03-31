"use client";

import { useState, useEffect, useRef } from "react";
import { Bot, Check, Loader2, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/lib/services/dashboard-service";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

interface OnboardingMcpGuideProps {
  onComplete: () => void;
}

const MCP_CONFIG = `{
  "mcpServers": {
    "ascend": {
      "type": "http",
      "url": "https://ascend.nativeai.agency/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;

export function OnboardingMcpGuide({ onComplete }: OnboardingMcpGuideProps) {
  const [goalsDetected, setGoalsDetected] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Poll the dashboard every 5 seconds to check if goals have been created
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/dashboard", { headers });
        if (res.ok) {
          const data: DashboardData = await res.json();
          if (data.streaksStats.totalGoals > 0) {
            setGoalsDetected(true);
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(MCP_CONFIG).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6 pb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold">
                AI-Guided Setup
              </h2>
              <p className="text-sm text-muted-foreground">
                Connect your AI assistant via MCP
              </p>
            </div>
          </div>

          {goalsDetected ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-medium">Setup Complete!</h3>
              <p className="text-sm text-muted-foreground">
                Goals have been detected in your account. Your AI assistant is
                connected and ready to help.
              </p>
              <Button onClick={onComplete}>Continue to Dashboard</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  1. Add this to your Claude Code MCP config:
                </h3>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                    {MCP_CONFIG}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute right-2 top-2 h-7 px-2"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Replace <code className="text-xs">YOUR_API_KEY</code> with
                  your actual API key.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  2. Ask your AI to create goals
                </h3>
                <p className="text-xs text-muted-foreground">
                  Try something like: &quot;Create a yearly goal for learning
                  Spanish with quarterly and monthly sub-goals.&quot;
                </p>
              </div>

              {/* Polling indicator */}
              <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for goals to be created via MCP...
              </div>

              {/* Manual done button */}
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onComplete}
                >
                  I am done, continue to dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
