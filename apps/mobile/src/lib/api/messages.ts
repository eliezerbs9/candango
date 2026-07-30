/** Deal emails: read (timeline) + send/reply (via the connected Gmail). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { ApiMessage, MessagesPage, SendMessageBody } from '@/lib/api/types';
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

export function useMessageBody(id: string | null) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['message-body', id],
    queryFn: () => apiFetch<{ html: string | null; text: string | null }>(`/messages/${id}/body`, { token: token! }),
    enabled: !!token && !!id,
  });
}

export function useSendMessage(dealId?: string) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendMessageBody) =>
      apiFetch<ApiMessage>('/messages/send', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => {
      if (dealId) qc.invalidateQueries({ queryKey: ['messages', 'deal', dealId] });
    },
  });
}
