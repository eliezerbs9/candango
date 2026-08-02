import { apiFetch } from './client';

/** Org-level catalog item for LOCAL estimates. Prices are minor units (cents). */
export interface EstimateItem {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPrice: number | null;
}

export interface EstimateItemBody {
  name?: string;
  description?: string;
  unit?: string;
  unitPrice?: number;
}

export function getEstimateItems(token: string) {
  return apiFetch<EstimateItem[]>('/estimate-items', { token });
}

export function createEstimateItem(token: string, body: EstimateItemBody) {
  return apiFetch<EstimateItem>('/estimate-items', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateEstimateItem(token: string, id: string, body: EstimateItemBody) {
  return apiFetch<EstimateItem>(`/estimate-items/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteEstimateItem(token: string, id: string) {
  return apiFetch<void>(`/estimate-items/${id}`, { method: 'DELETE', token });
}
