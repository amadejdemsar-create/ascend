"use client";

interface XpProgressBarProps {
  current: number;
  needed: number;
  percentage: number;
  level: number;
}

export function XpProgressBar({
  current,
  needed,
  percentage,
  level,
}: XpProgressBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Level {level}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {current} / {needed} XP
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-label={`Level ${level} progress: ${current} of ${needed} XP`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
