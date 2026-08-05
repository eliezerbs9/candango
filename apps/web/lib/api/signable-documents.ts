import { apiFetch } from './client';
import type { CanvasPage, ProposalTheme } from './proposals';
import type { DrawnField } from './signature-templates';

export type SignableDocMode = 'html' | 'builder' | 'upload';

export interface SignableDocumentTemplate {
  id: string;
  name: string;
  mode: SignableDocMode;
  parties: 'one' | 'both';
  party2Source: 'owner' | 'user';
  party2UserId: string | null;
  initialsRule: 'none' | 'every_page' | 'specified_pages' | 'last_page';
  initialsPages: number[];
  initialsParty: 'client' | 'sender' | 'both';
  bodyHtml: string;
  layout: CanvasPage[];
  theme: Partial<ProposalTheme>;
  fileKey: string | null;
  fields: DrawnField[];
  createdAt: string;
  updatedAt: string;
}

export interface SignableDocumentBody {
  name?: string;
  mode?: SignableDocMode;
  parties?: 'one' | 'both';
  party2Source?: 'owner' | 'user';
  party2UserId?: string | null;
  initialsRule?: 'none' | 'every_page' | 'specified_pages' | 'last_page';
  initialsPages?: number[];
  initialsParty?: 'client' | 'sender' | 'both';
  bodyHtml?: string;
  layout?: CanvasPage[];
  theme?: Partial<ProposalTheme>;
  fileKey?: string | null;
  fields?: DrawnField[];
}

export function getSignableDocuments(token: string) {
  return apiFetch<SignableDocumentTemplate[]>('/signable-documents', { token });
}

export function getSignableDocument(token: string, id: string) {
  return apiFetch<SignableDocumentTemplate>(`/signable-documents/${id}`, { token });
}

export function createSignableDocument(token: string, body: SignableDocumentBody) {
  return apiFetch<SignableDocumentTemplate>('/signable-documents', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateSignableDocument(token: string, id: string, body: SignableDocumentBody) {
  return apiFetch<SignableDocumentTemplate>(`/signable-documents/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteSignableDocument(token: string, id: string) {
  return apiFetch<void>(`/signable-documents/${id}`, { method: 'DELETE', token });
}
