/**
 * Deals + stages/pipelines API hooks. Mirrors apps/web/lib/api/deals.ts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Address, ApiDeal, ApiPipeline, ApiStage, CreateDealBody, StageEvent } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';

export type DealFilters = { status?: string; archived?: boolean };

function getDeals(token: string, filters: DealFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.archived) qs.set('archived', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ApiDeal[]>(`/deals${suffix}`, { token });
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
    queryFn: () => apiFetch<ApiDeal>(`/deals/${id}`, { token: token! }),
    enabled: !!token && !!id,
  });
}

export function useStages() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['stages'],
    queryFn: () => apiFetch<ApiStage[]>('/stages', { token: token! }),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}

export function usePipelines() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => apiFetch<ApiPipeline[]>('/pipelines', { token: token! }),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}

export function useStageHistory(id: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['deal', id, 'stage-history'],
    queryFn: () => apiFetch<StageEvent[]>(`/deals/${id}/stage-history`, { token: token! }),
    enabled: !!token && !!id,
  });
}

/** Invalidate the deal lists + a single deal's cache after a mutation. */
function useDealInvalidate() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: ['deals'] });
    if (id) qc.invalidateQueries({ queryKey: ['deal', id] });
  };
}

export function useCreateDeal() {
  const token = useAuthStore((s) => s.token);
  const invalidate = useDealInvalidate();
  return useMutation({
    mutationFn: (body: CreateDealBody) =>
      apiFetch<ApiDeal>('/deals', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: (deal) => invalidate(deal.id),
  });
}

type UpdateDealBody = Partial<{
  title: string;
  value: number;
  currency: string;
  stageId: string;
  companyId: string | null;
  primaryPersonId: string | null;
  expectedCloseDate: string | null;
  shipTo: Address;
  billTo: Address;
  customFields: Record<string, unknown>;
}>;

export function useUpdateDeal() {
  const token = useAuthStore((s) => s.token);
  const invalidate = useDealInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateDealBody) =>
      apiFetch<ApiDeal>(`/deals/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: (deal) => invalidate(deal.id),
  });
}

export function useMoveDeal() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      apiFetch<ApiDeal>(`/deals/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify({ stageId }) }),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deal', deal.id] });
      qc.invalidateQueries({ queryKey: ['deal', deal.id, 'stage-history'] });
    },
  });
}

/** Lifecycle: win / lose / reopen / archive. Returns one mutation per action. */
export function useDealLifecycle() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const invalidate = (id: string) => {
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['deal', id] });
    qc.invalidateQueries({ queryKey: ['notes', id] });
  };
  const action = (path: string, extra?: object) => (id: string) =>
    apiFetch<ApiDeal>(`/deals/${id}/${path}`, {
      method: 'POST',
      token: token!,
      body: extra ? JSON.stringify(extra) : undefined,
    });

  const win = useMutation({ mutationFn: action('win'), onSuccess: (d) => invalidate(d.id) });
  const reopen = useMutation({ mutationFn: action('reopen'), onSuccess: (d) => invalidate(d.id) });
  const archive = useMutation({ mutationFn: action('archive'), onSuccess: (d) => invalidate(d.id) });
  const lose = useMutation({
    mutationFn: ({ id, lostReason }: { id: string; lostReason?: string }) =>
      apiFetch<ApiDeal>(`/deals/${id}/lose`, {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ lostReason }),
      }),
    onSuccess: (d) => invalidate(d.id),
  });
  return { win, lose, reopen, archive };
}
