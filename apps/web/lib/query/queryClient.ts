import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

/**
 * On any 401 (expired/invalid token — e.g. a stale session), clear auth and
 * bounce to /login instead of silently showing empty data.
 */
function handleError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    useAuthStore.getState().signOut();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
}

export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Don't retry auth/permission/not-found errors.
          if (
            error instanceof ApiError &&
            [401, 403, 404].includes(error.status)
          ) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}
