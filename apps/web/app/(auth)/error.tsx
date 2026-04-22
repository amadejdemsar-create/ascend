"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Segment-level error boundary for the (auth) route group.
 *
 * Catches render errors that would otherwise crash the login page.
 * Satisfies DZ-7 (no error boundaries) for the auth surface.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth] render error:", error);
  }, [error]);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        We could not render the sign-in page. Try again, or reload the app.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
