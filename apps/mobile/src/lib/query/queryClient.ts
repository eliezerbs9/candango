/**
 * TanStack Query client — mirrors apps/web/lib/query/queryClient.ts.
 * Caches server data, handles loading/refetch, and skips retries for
 * auth/permission/not-found errors.
 */
import { MutationCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/client';
import { showToast } from '@/lib/toast';

export const queryClient = new QueryClient({
  // Surface any failed mutation as an error toast (401 is handled by apiFetch →
  // sign-out, so skip it here to avoid a toast on the way to the login screen).
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) return;
      const message = error instanceof Error ? error.message : 'Something went wrong';
      showToast(message, 'error');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 402, 403, 404].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});
