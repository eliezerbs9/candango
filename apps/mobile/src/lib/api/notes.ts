/** Notes API hooks (deal timeline). Mirrors apps/web/lib/api/notes.ts. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { ApiNote } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';

export function useNotes(dealId: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['notes', dealId],
    queryFn: () => apiFetch<ApiNote[]>(`/notes?deal_id=${dealId}`, { token: token! }),
    enabled: !!token && !!dealId,
  });
}

export function useCreateNote(dealId: string) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<ApiNote>('/notes', {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ body, dealId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', dealId] }),
  });
}
