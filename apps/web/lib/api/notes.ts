import { apiFetch } from './client';

export interface ApiNote {
  id: string;
  body: string;
  dealId: string | null;
  personId: string | null;
  authorUserId: string;
  authorName: string;
  createdAt: string;
}

export function getNotes(token: string, filters: { dealId?: string; personId?: string } = {}) {
  const qs = new URLSearchParams();
  if (filters.dealId) qs.set('deal_id', filters.dealId);
  if (filters.personId) qs.set('person_id', filters.personId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ApiNote[]>(`/notes${suffix}`, { token });
}

export function createNote(token: string, body: { body: string; dealId?: string; personId?: string }) {
  return apiFetch<ApiNote>('/notes', { method: 'POST', token, body: JSON.stringify(body) });
}

export function deleteNote(token: string, id: string) {
  return apiFetch<void>(`/notes/${id}`, { method: 'DELETE', token });
}
