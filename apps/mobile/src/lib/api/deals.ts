/**
 * Deals + stages API hooks. Mirrors apps/web/lib/api/deals.ts and pipelines.ts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { ApiDeal, ApiStage } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';

export type DealFilters = { status?: string; archived?: boolean };

function getDeals(token: string, filters: DealFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.archived) qs.set('archived', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ApiDeal[]>(`/deals${suffix}`, { token });
}

function getDeal(token: string, id: string) {
  return apiFetch<ApiDeal>(`/deals/${id}`, { token });
}

function getAllStages(token: string) {
  return apiFetch<ApiStage[]>('/stages', { token });
}

function updateDeal(token: string, id: string, body: Partial<{ stageId: string }>) {
  return apiFetch<ApiDeal>(`/deals/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export function useDeals(filters: DealFilters = {}) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: () => getDeals(token!, filters),
    enabled: !!token,
  });
}

export function useDeal(id: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => getDeal(token!, id),
    enabled: !!token && !!id,
  });
}

export function useStages() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['stages'],
    queryFn: () => getAllStages(token!),
    enabled: !!token,
    staleTime: 5 * 60_000, // stages rarely change
  });
}

export function useMoveDeal() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      updateDeal(token!, id, { stageId }),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deal', deal.id] });
    },
  });
}
