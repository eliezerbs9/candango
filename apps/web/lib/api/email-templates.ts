import { apiFetch } from './client';

/** Reusable email template. `subject`/`body` may contain {{variables}}. */
export type TemplateBodyFormat = 'richtext' | 'html';

/** Which variable context a template renders against + where it can be used. */
export type TemplateScope = 'deal' | 'marketing' | 'proposal';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  bodyFormat: TemplateBodyFormat;
  scope: TemplateScope;
  /** Non-null for protected built-ins (Send estimate/invoice). */
  systemKey: string | null;
  /** True when the template is a protected system template (cannot be deleted). */
  system: boolean;
  tags: string[];
  updatedAt: string;
}

export interface EmailTemplateBody {
  name?: string;
  subject?: string;
  body?: string;
  bodyFormat?: TemplateBodyFormat;
  /** Only honoured on create — scope is immutable afterwards. */
  scope?: TemplateScope;
  tags?: string[];
}

/** A placeholder the user can insert into a template subject/body. */
export interface TemplateVariable {
  key: string;
  label: string;
  group: string;
  example: string;
  /** Scopes this variable is available in (absent = available everywhere). */
  scopes?: TemplateScope[];
  /** Valid for rendering but hidden from the click-to-insert palette (e.g. image URLs). */
  hidden?: boolean;
}

export function getEmailTemplates(token: string) {
  return apiFetch<EmailTemplate[]>('/email-templates', { token });
}

export function getTemplateVariables(token: string) {
  return apiFetch<TemplateVariable[]>('/email-templates/variables', { token });
}

export function createEmailTemplate(token: string, body: EmailTemplateBody) {
  return apiFetch<EmailTemplate>('/email-templates', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateEmailTemplate(token: string, id: string, body: EmailTemplateBody) {
  return apiFetch<EmailTemplate>(`/email-templates/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteEmailTemplate(token: string, id: string) {
  return apiFetch<void>(`/email-templates/${id}`, { method: 'DELETE', token });
}

/** Backfill any missing starter templates (Send estimate / Send invoice / Follow-up). */
export function seedDefaultTemplates(token: string) {
  return apiFetch<EmailTemplate[]>('/email-templates/seed-defaults', { method: 'POST', token });
}

/** Resolve a template's subject + body against a deal (for the send composer). */
export function renderEmailTemplate(token: string, id: string, dealId?: string) {
  const q = dealId ? `?dealId=${encodeURIComponent(dealId)}` : '';
  return apiFetch<{ subject: string; body: string }>(`/email-templates/${id}/render${q}`, { token });
}
