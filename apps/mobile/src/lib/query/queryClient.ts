/**
 * TanStack Query client — mirrors apps/web/lib/query/queryClient.ts.
 * Caches server data, handles loading/refetch, and skips retries for
 * auth/permission/not-found errors.
 */
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/client';

export const queryClient = new QueryClient({
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
