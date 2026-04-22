"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Client-side login form.
 *
 * Rendered inside a Suspense boundary by `page.tsx` because it calls
 * `useSearchParams()`, which Next.js 16 requires to be wrapped in
 * Suspense whenever a route might otherwise be statically prerendered.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.post("/api/auth/login", { email, password });
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            "Too many attempts. Please wait 15 minutes and try again.",
          );
        } else if (err.status === 401) {
          setError("Invalid email or password.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else {
        setError(
          "Network error. Please check your connection and try again.",
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          disabled={submitting}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={submitting}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
