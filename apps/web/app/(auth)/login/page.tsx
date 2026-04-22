import { Suspense } from "react";
import { LoginForm } from "./login-form";

/**
 * Login page for Ascend.
 *
 * Server component that wraps the client-side LoginForm in a Suspense
 * boundary. Suspense is required because LoginForm calls useSearchParams,
 * which Next.js 16 refuses to statically prerender without one.
 *
 * The route is inherently dynamic (middleware redirects unauthenticated
 * visitors here with a `redirect` query param at request time), so opting
 * out of static optimization is correct.
 */
export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Sign in to Ascend</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and password.
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
