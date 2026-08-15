import { apiFetch } from './client';
import type { Address, ApiDeal } from './types';

export interface DealFilters {
  pipelineId?: string;
  stageId?: string;
  status?: string;
  archived?: boolean;
}

export interface StageEvent {
  id: string;
  fromStage: { id: string; name: string | null } | null;
  toStage: { id: string; name: string | null };
  changedByUserId: string | null;
  createdAt: string;
}

export interface WinRequirement {
  key: 'fields' | 'stage' | 'proposal' | 'signed' | 'invoice';
  label: string;
  met: boolean;
}
export interface WinCheck {
  canWin: boolean;
  requirements: WinRequirement[];
}

export function getDeal(token: string, id: string) {
  return apiFetch<ApiDeal>(`/deals/${id}`, { token });
}

export function getWinCheck(token: string, id: string) {
  return apiFetch<WinCheck>(`/deals/${id}/win-check`, { token });
}

export function getStageHistory(token: string, id: string) {
  return apiFetch<StageEvent[]>(`/deals/${id}/stage-history`, { token });
}

/** A system/automation event on the deal (automation ran, proposal responded, signature lifecycle). */
export interface DealEvent {
  id: string;
  kind: 'automation' | 'proposal' | 'signature' | 'email';
  title: string;
  body: string | null;
  actor: string | null;
  createdAt: string;
}

export function getDealEvents(token: string, id: string) {
  return apiFetch<DealEvent[]>(`/deals/${id}/events`, { token });
}

export function getDeals(token: string, filters: DealFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.pipelineId) qs.set('pipeline_id', filters.pipelineId);
  if (filters.stageId) qs.set('stage_id', filters.stageId);
  if (filters.status) qs.set('status', filters.status);
  if (filters.archived) qs.set('archived', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ApiDeal[]>(`/deals${suffix}`, { token });
}

export interface DealRecipient {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

/** The deal's people (primary contact, participants, company contacts) for the email composer. */
export function getDealRecipients(token: string, dealId: string) {
  return apiFetch<DealRecipient[]>(`/deals/${dealId}/recipients`, { token });
}

/** A deal participant with address, for the client/Bill-Ship UI. */
export interface DealParticipant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: Address | null;
  customFields: Record<string, unknown>;
  source: 'deal-primary' | 'company-primary' | 'participant' | 'field';
  removable: boolean;
}

/** The deal's people (primary + company primary + participants) with addresses. */
export function getDealParticipants(token: string, dealId: string) {
  return apiFetch<DealParticipant[]>(`/deals/${dealId}/participants`, { token });
}

/** Link a person to the deal as a participant. */
export function addDealParticipant(token: string, dealId: string, personId: string) {
  return apiFetch<{ ok: boolean }>(`/deals/${dealId}/participants`, { method: 'POST', token, body: JSON.stringify({ personId }) });
}

/** Unlink a manually-added participant. */
export function removeDealParticipant(token: string, dealId: string, personId: string) {
  return apiFetch<{ ok: boolean }>(`/deals/${dealId}/participants/${personId}`, { method: 'DELETE', token });
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
    participantIds?: string[];
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
    shipTo: Address;
    billTo: Address;
    tags: string[];
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

export function reopenDeal(token: string, id: string) {
  return apiFetch<ApiDeal>(`/deals/${id}/reopen`, { method: 'POST', token });
}

export function archiveDeal(token: string, id: string) {
  return apiFetch<ApiDeal>(`/deals/${id}/archive`, { method: 'POST', token });
}
