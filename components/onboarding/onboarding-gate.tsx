"use client";

import { useState } from "react";
import { OnboardingChoice, type OnboardingPath } from "./onboarding-choice";
import { OnboardingWizard } from "./onboarding-wizard";
import { OnboardingMcpGuide } from "./onboarding-mcp-guide";

interface OnboardingGateProps {
  onComplete: () => void;
}

export function OnboardingGate({ onComplete }: OnboardingGateProps) {
  const [path, setPath] = useState<OnboardingPath | "choice">("choice");

  if (path === "choice") {
    return (
      <OnboardingChoice
        onSelect={(selected) => {
          if (selected === "skip") {
            // Skip goes directly to dashboard
            onComplete();
            return;
          }
          setPath(selected);
        }}
      />
    );
  }

  if (path === "wizard") {
    return <OnboardingWizard onComplete={onComplete} />;
  }

  if (path === "mcp") {
    return <OnboardingMcpGuide onComplete={onComplete} />;
  }

  return null;
}
