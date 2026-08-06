import { apiFetch } from './client';
import type { CanvasPage, ProposalTheme } from './proposals';
import type { DrawnField } from './signature-templates';

export type SignableDocMode = 'html' | 'builder' | 'upload';

export interface SignableDocumentTemplate {
  id: string;
  dealId: string | null;
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
  dealId?: string;
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

/** True when the builder layout has at least one signature or initials field — required before sending. */
export function hasSigningField(layout: unknown): boolean {
  const pages = (Array.isArray(layout) ? layout : []) as { elements?: { type?: string; props?: { fieldType?: string } }[] }[];
  return pages.some((p) => (p.elements ?? []).some((el) => el?.type === 'field' && (el.props?.fieldType === 'signature' || el.props?.fieldType === 'initials')));
}

export function getSignableDocuments(token: string) {
  return apiFetch<SignableDocumentTemplate[]>('/signable-documents', { token });
}

/** One-off documents drafted for a deal (not the reusable templates) — shown on the deal's Signatures tab. */
export function getDealDocuments(token: string, dealId: string) {
  return apiFetch<SignableDocumentTemplate[]>(`/signable-documents?dealId=${encodeURIComponent(dealId)}`, { token });
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

export function duplicateSignableDocument(token: string, id: string) {
  return apiFetch<SignableDocumentTemplate>(`/signable-documents/${id}/duplicate`, { method: 'POST', token });
}

/** Copy a reusable template into a one-off document for a deal (edited in the builder, then sent). */
export function createDealDocFromTemplate(token: string, id: string, dealId: string) {
  return apiFetch<SignableDocumentTemplate>(`/signable-documents/${id}/for-deal`, { method: 'POST', token, body: JSON.stringify({ dealId }) });
}

/** Duplicate a deal document (a draft, or a sent request's pre-PDF source) into a new deal draft. */
export function duplicateDealDoc(token: string, id: string) {
  return apiFetch<SignableDocumentTemplate>(`/signable-documents/${id}/duplicate-in-deal`, { method: 'POST', token });
}
