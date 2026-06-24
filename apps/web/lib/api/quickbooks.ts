import { apiFetch } from './client';
import type { ConvertToInvoiceInput, CreateDocInput, DealDoc, QbCustomer, QbItem, QbLinkStatus } from './types';

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

export function getQbLinkStatus(token: string, dealId: string) {
  return apiFetch<QbLinkStatus>(`/deals/${dealId}/quickbooks/link-status`, { token });
}

export function getQbItems(token: string, dealId: string) {
  return apiFetch<QbItem[]>(`/deals/${dealId}/quickbooks/items`, { token });
}

export function getDealEstimates(token: string, dealId: string) {
  return apiFetch<DealDoc[]>(`/deals/${dealId}/estimates`, { token });
}

export function createDealEstimate(token: string, dealId: string, body: CreateDocInput) {
  return apiFetch<DealDoc>(`/deals/${dealId}/estimates`, { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateDealEstimate(token: string, dealId: string, estimateId: string, body: CreateDocInput) {
  return apiFetch<DealDoc>(`/deals/${dealId}/estimates/${estimateId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
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

export function convertEstimatesToInvoice(token: string, dealId: string, body: ConvertToInvoiceInput) {
  return apiFetch<DealDoc>(`/deals/${dealId}/invoices/from-estimates`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function updateDealInvoice(token: string, dealId: string, invoiceId: string, body: CreateDocInput) {
  return apiFetch<DealDoc>(`/deals/${dealId}/invoices/${invoiceId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export function setInvoiceStatus(token: string, dealId: string, invoiceId: string, status: string) {
  return apiFetch<DealDoc>(`/deals/${dealId}/invoices/${invoiceId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}
