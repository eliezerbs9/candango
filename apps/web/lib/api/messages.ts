import { apiFetch } from './client';

export type MessageFolder = 'inbox' | 'sent' | 'trash' | 'spam' | 'other';

export interface ApiMessage {
  id: string;
  direction: 'in' | 'out';
  fromAddress: string;
  toAddresses: string[];
  subject: string | null;
  snippet: string | null;
  folder: MessageFolder;
  threadId: string | null;
  personId: string | null;
  dealId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface MessagesPage {
  data: ApiMessage[];
  nextCursor: string | null;
}

export interface MessageFilters {
  dealId?: string;
  personId?: string;
  mine?: boolean;
  folder?: MessageFolder;
  limit?: number;
  cursor?: string;
}

export function getMessages(token: string, filters: MessageFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.dealId) qs.set('deal_id', filters.dealId);
  if (filters.personId) qs.set('person_id', filters.personId);
  if (filters.mine) qs.set('mine', '1');
  if (filters.folder) qs.set('folder', filters.folder);
  if (filters.limit) qs.set('limit', String(filters.limit));
  if (filters.cursor) qs.set('cursor', filters.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<MessagesPage>(`/messages${suffix}`, { token });
}

export interface SendBody {
  to: string[];
  subject: string;
  body: string;
  dealId?: string;
  threadId?: string;
  inReplyTo?: string;
}

export function sendMessage(token: string, body: SendBody) {
  return apiFetch<ApiMessage>('/messages/send', { method: 'POST', token, body: JSON.stringify(body) });
}

export function getMessage(token: string, id: string) {
  return apiFetch<ApiMessage>(`/messages/${id}`, { token });
}

export function getFolderCounts(token: string) {
  return apiFetch<Record<string, number>>('/messages/folder-counts', { token });
}

export function getMessageBody(token: string, id: string) {
  return apiFetch<{ html: string | null; text: string | null }>(`/messages/${id}/body`, { token });
}
