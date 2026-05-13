"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";

interface MeUser {
  id: string;
  email: string;
  name: string | null;
}

interface MeResponse {
  user: MeUser;
  workspaceId: string;
}

/**
 * Fetches the current authenticated user via GET /api/auth/me.
 *
 * Returns both the user object and the current workspaceId (resolved
 * from the auth context server-side). The workspaceId is used by the
 * activity feed and other workspace-scoped UI features.
 *
 * Cached with 5min staleTime so the identity is not refetched on
 * every editor mount. The existing 401 interceptor in apiFetch
 * handles expired sessions (redirect to /login).
 */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      const res = await apiFetch<MeResponse>("/api/auth/me");
      return { ...res.user, workspaceId: res.workspaceId };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
