import { apiFetch } from './client';

export interface SignableDocumentTemplate {
  id: string;
  name: string;
  bodyHtml: string;
  createdAt: string;
  updatedAt: string;
}

export interface SignableDocumentBody {
  name: string;
  bodyHtml?: string;
}

export function getSignableDocuments(token: string) {
  return apiFetch<SignableDocumentTemplate[]>('/signable-documents', { token });
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
