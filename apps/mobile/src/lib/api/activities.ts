/**
 * Activities API hooks. Mirrors apps/web/lib/api/activities.ts.
 * List: GET /activities (filters). Create: POST /activities. Complete: POST /activities/:id/complete.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { ActivityBody, ApiActivity } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';

export type ActivityFilters = { dealId?: string; assignee?: string; type?: string };

function getActivities(token: string, filters: ActivityFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.dealId) qs.set('deal_id', filters.dealId);
  if (filters.assignee) qs.set('assignee', filters.assignee);
  if (filters.type) qs.set('type', filters.type);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ApiActivity[]>(`/activities${suffix}`, { token });
}

export function useActivities(filters: ActivityFilters = {}) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['activities', filters],
    queryFn: () => getActivities(token!, filters),
    enabled: !!token,
  });
}

export function useCreateActivity() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ActivityBody) =>
      apiFetch<ApiActivity>('/activities', {
        method: 'POST',
        token: token!,
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useCompleteActivity() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiActivity>(`/activities/${id}/complete`, { method: 'POST', token: token! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useUpdateActivity() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<ActivityBody> & { done?: boolean }) =>
      apiFetch<ApiActivity>(`/activities/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}
