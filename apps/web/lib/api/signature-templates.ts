import { apiFetch } from './client';

export type InitialsRule = 'none' | 'every_page' | 'specified_pages' | 'last_page';

/** A visually-placed field (Phase 3). Coords normalized 0–1, page 1-indexed. */
export interface DrawnField {
  type: 'signature' | 'initials' | 'date' | 'text' | 'checkbox';
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface SignatureTemplate {
  id: string;
  name: string;
  initialsRule: InitialsRule;
  initialsPages: number[];
  acceptance: boolean;
  acceptanceText: string | null;
  fields: DrawnField[];
  requireCounterSigner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureTemplateBody {
  name: string;
  initialsRule?: InitialsRule;
  initialsPages?: number[];
  acceptance?: boolean;
  acceptanceText?: string | null;
  fields?: DrawnField[];
  requireCounterSigner?: boolean;
}

export function getSignatureTemplates(token: string) {
  return apiFetch<SignatureTemplate[]>('/signature-templates', { token });
}

export function createSignatureTemplate(token: string, body: SignatureTemplateBody) {
  return apiFetch<SignatureTemplate>('/signature-templates', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateSignatureTemplate(token: string, id: string, body: SignatureTemplateBody) {
  return apiFetch<SignatureTemplate>(`/signature-templates/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteSignatureTemplate(token: string, id: string) {
  return apiFetch<void>(`/signature-templates/${id}`, { method: 'DELETE', token });
}
