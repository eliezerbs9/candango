import { apiFetch } from './client';
import type { CreateDocInput, DealDoc, QbCustomer } from './types';

export interface LinkAccountInput {
  parentCustomerId?: string;
  createParent?: boolean;
}

export function linkQuickbooks(token: string, dealId: string, body: LinkAccountInput) {
  return apiFetch<{ qbSubcustomerId: string; parentCustomerId: string }>(`/deals/${dealId}/quickbooks/link`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function searchQbParents(token: string, dealId: string, q: string) {
  return apiFetch<QbCustomer[]>(`/deals/${dealId}/quickbooks/parent-search?q=${encodeURIComponent(q)}`, { token });
}

export function getDealEstimates(token: string, dealId: string) {
  return apiFetch<DealDoc[]>(`/deals/${dealId}/estimates`, { token });
}

export function createDealEstimate(token: string, dealId: string, body: CreateDocInput) {
  return apiFetch<DealDoc>(`/deals/${dealId}/estimates`, { method: 'POST', token, body: JSON.stringify(body) });
}

export function setEstimateStatus(token: string, dealId: string, estimateId: string, status: string) {
  return apiFetch<DealDoc>(`/deals/${dealId}/estimates/${estimateId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}

export function applyEstimateAsValue(token: string, dealId: string, estimateId: string) {
  return apiFetch<{ value: number }>(`/deals/${dealId}/estimates/${estimateId}/use-as-value`, {
    method: 'POST',
    token,
  });
}

export function getDealInvoices(token: string, dealId: string) {
  return apiFetch<DealDoc[]>(`/deals/${dealId}/invoices`, { token });
}

export function createDealInvoice(token: string, dealId: string, body: CreateDocInput) {
  return apiFetch<DealDoc>(`/deals/${dealId}/invoices`, { method: 'POST', token, body: JSON.stringify(body) });
}

export function setInvoiceStatus(token: string, dealId: string, invoiceId: string, status: string) {
  return apiFetch<DealDoc>(`/deals/${dealId}/invoices/${invoiceId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}
