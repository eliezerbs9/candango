import { apiFetch } from './client';

export type ProposalBlockType = 'cover' | 'text' | 'image' | 'document' | 'pricing';

export interface ProposalBlock {
  type: ProposalBlockType;
  props: Record<string, unknown>;
}

export interface ProposalColumn {
  id: string;
  width: number; // 12-unit grid
  block: ProposalBlock | null;
}

export interface ProposalRow {
  id: string;
  columns: ProposalColumn[];
}

export interface ProposalTheme {
  primaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  coverStyle: 'solid' | 'image';
}

export interface ProposalTemplate {
  id: string;
  name: string;
  theme: ProposalTheme;
  layout: ProposalRow[];
  systemKey: string | null;
  system: boolean;
  updatedAt: string;
}

export interface ProposalMeta {
  blocks: { type: ProposalBlockType; label: string; description: string }[];
  fonts: string[];
  defaultTheme: ProposalTheme;
}

export interface ProposalTemplateBody {
  name?: string;
  theme?: ProposalTheme;
  layout?: ProposalRow[];
}

export function getProposalMeta(token: string) {
  return apiFetch<ProposalMeta>('/proposal-templates/meta', { token });
}

export function getProposalTemplates(token: string) {
  return apiFetch<ProposalTemplate[]>('/proposal-templates', { token });
}

export function getProposalTemplate(token: string, id: string) {
  return apiFetch<ProposalTemplate>(`/proposal-templates/${id}`, { token });
}

export function createProposalTemplate(token: string, body: ProposalTemplateBody) {
  return apiFetch<ProposalTemplate>('/proposal-templates', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateProposalTemplate(token: string, id: string, body: ProposalTemplateBody) {
  return apiFetch<ProposalTemplate>(`/proposal-templates/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteProposalTemplate(token: string, id: string) {
  return apiFetch<void>(`/proposal-templates/${id}`, { method: 'DELETE', token });
}

export function seedProposalTemplates(token: string) {
  return apiFetch<ProposalTemplate[]>('/proposal-templates/seed-defaults', { method: 'POST', token });
}
