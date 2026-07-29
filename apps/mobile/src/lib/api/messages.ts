/** Deal-scoped emails (read-only, for the deal timeline). */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { MessagesPage } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';

export function useDealMessages(dealId: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['messages', 'deal', dealId],
    queryFn: () => apiFetch<MessagesPage>(`/messages?deal_id=${dealId}&limit=50`, { token: token! }),
    enabled: !!token && !!dealId,
    select: (page) => page.data,
  });
}
