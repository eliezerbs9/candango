import { apiFetch } from './client';
import type { ApiDeal } from './types';

export interface DealFilters {
  pipelineId?: string;
  stageId?: string;
  status?: string;
}

export interface StageEvent {
  id: string;
  fromStage: { id: string; name: string | null } | null;
  toStage: { id: string; name: string | null };
  changedByUserId: string | null;
  createdAt: string;
}

export function getDeal(token: string, id: string) {
  return apiFetch<ApiDeal>(`/deals/${id}`, { token });
}

export function getStageHistory(token: string, id: string) {
  return apiFetch<StageEvent[]>(`/deals/${id}/stage-history`, { token });
}

export function getDeals(token: string, filters: DealFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.pipelineId) qs.set('pipeline_id', filters.pipelineId);
  if (filters.stageId) qs.set('stage_id', filters.stageId);
  if (filters.status) qs.set('status', filters.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ApiDeal[]>(`/deals${suffix}`, { token });
}

export function createDeal(
  token: string,
  body: {
    title: string;
    value?: number;
    currency?: string;
    pipelineId: string;
    stageId: string;
    companyId?: string;
    primaryPersonId?: string;
  },
) {
  return apiFetch<ApiDeal>('/deals', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateDeal(
  token: string,
  id: string,
  body: Partial<{
    title: string;
    value: number;
    currency: string;
    stageId: string;
    companyId: string;
    primaryPersonId: string;
    expectedCloseDate: string;
    customFields: Record<string, unknown>;
    shipTo: Record<string, unknown>;
    billTo: Record<string, unknown>;
  }>,
) {
  return apiFetch<ApiDeal>(`/deals/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function winDeal(token: string, id: string) {
  return apiFetch<ApiDeal>(`/deals/${id}/win`, { method: 'POST', token });
}

export function loseDeal(token: string, id: string, lostReason?: string) {
  return apiFetch<ApiDeal>(`/deals/${id}/lose`, {
    method: 'POST',
    token,
    body: JSON.stringify({ lostReason }),
  });
}
