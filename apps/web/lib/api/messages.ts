import { apiFetch } from './client';

export interface ApiMessage {
  id: string;
  direction: 'in' | 'out';
  fromAddress: string;
  toAddresses: string[];
  subject: string | null;
  snippet: string | null;
  personId: string | null;
  dealId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export function getMessages(
  token: string,
  filters: { dealId?: string; personId?: string; mine?: boolean } = {},
) {
  const qs = new URLSearchParams();
  if (filters.dealId) qs.set('deal_id', filters.dealId);
  if (filters.personId) qs.set('person_id', filters.personId);
  if (filters.mine) qs.set('mine', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ApiMessage[]>(`/messages${suffix}`, { token });
}
