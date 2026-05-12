"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";

interface MeUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Fetches the current authenticated user via GET /api/auth/me.
 *
 * Cached with 5min staleTime so the identity is not refetched on
 * every editor mount. The existing 401 interceptor in apiFetch
 * handles expired sessions (redirect to /login).
 */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      const res = await apiFetch<{ user: MeUser }>("/api/auth/me");
      return res.user;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
