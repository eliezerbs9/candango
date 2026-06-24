import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

/**
 * On any 401 (expired/invalid token — e.g. a stale session), clear auth and
 * bounce to /login. On 402 the workspace is locked (FR-10.5): surface a single
 * notification and send the user to billing so they can add a payment method.
 */
function handleError(error: unknown) {
  if (!(error instanceof ApiError)) return;
  if (error.status === 401) {
    useAuthStore.getState().signOut();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
  if (error.status === 402) {
    notifications.show({
      id: 'workspace-locked',
      color: 'red',
      title: 'Workspace locked',
      message: error.message,
    });
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/settings/billing')) {
      window.location.href = '/settings/billing';
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
            [401, 402, 403, 404].includes(error.status)
          ) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}
