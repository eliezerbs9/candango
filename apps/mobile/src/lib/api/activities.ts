/**
 * Activities API hooks. Mirrors apps/web/lib/api/activities.ts.
 * List: GET /activities (filters). Create: POST /activities. Complete: POST /activities/:id/complete.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

const ACTIVITIES_PAGE_SIZE = 20;

/** Server-paginated activities for the tab: each "View more" fetches the next
 * page (saves bandwidth vs loading everything). `done` filters open-only; `q`
 * searches the subject; ordered by due date ascending on the server. */
export function useActivitiesInfinite(filters: { done?: boolean; q?: string } = {}) {
  const token = useAuthStore((s) => s.token);
  return useInfiniteQuery({
    queryKey: ['activities', 'infinite', { done: filters.done ?? null, q: filters.q ?? '' }],
    enabled: !!token,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams();
      qs.set('limit', String(ACTIVITIES_PAGE_SIZE));
      qs.set('offset', String(pageParam));
      if (filters.done !== undefined) qs.set('done', String(filters.done));
      if (filters.q) qs.set('q', filters.q);
      return apiFetch<ApiActivity[]>(`/activities?${qs.toString()}`, { token: token! });
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < ACTIVITIES_PAGE_SIZE ? undefined : allPages.length * ACTIVITIES_PAGE_SIZE,
  });
}

/** Fetch a single activity (used to edit one from a paginated deal timeline). */
export function useActivity(id: string | null) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['activity', id],
    queryFn: () => apiFetch<ApiActivity>(`/activities/${id}`, { token: token! }),
    enabled: !!token && !!id,
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
