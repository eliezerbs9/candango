import { apiFetch } from './client';

export type AutomationAction = 'send_email' | 'create_activity';

export interface EmailAutomation {
  id: string;
  name: string;
  enabled: boolean;
  category: string;
  tags: string[];
  trigger: string;
  action: AutomationAction;
  config: Record<string, unknown>;
  templateId: string | null;
  templateName: string | null;
  updatedAt: string;
}

/** System-defined automation category (users pick one but cannot create categories). */
export interface AutomationCategory {
  key: string;
  label: string;
  description: string;
}

export interface AutomationTriggerField {
  key: string;
  label: string;
  type: 'stage' | 'docKind' | 'days';
  required?: boolean;
}

export interface AutomationTrigger {
  key: string;
  label: string;
  description: string;
  kind: 'event' | 'time';
  events?: string[];
  fields: AutomationTriggerField[];
  comingSoon?: boolean;
}

export interface EmailAutomationBody {
  name?: string;
  category?: string;
  tags?: string[];
  trigger?: string;
  action?: AutomationAction;
  templateId?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export function getEmailAutomations(token: string) {
  return apiFetch<EmailAutomation[]>('/email-automations', { token });
}

export function getAutomationTriggers(token: string) {
  return apiFetch<AutomationTrigger[]>('/email-automations/triggers', { token });
}

export function getAutomationCategories(token: string) {
  return apiFetch<AutomationCategory[]>('/email-automations/categories', { token });
}

export function createEmailAutomation(token: string, body: EmailAutomationBody) {
  return apiFetch<EmailAutomation>('/email-automations', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateEmailAutomation(token: string, id: string, body: EmailAutomationBody) {
  return apiFetch<EmailAutomation>(`/email-automations/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteEmailAutomation(token: string, id: string) {
  return apiFetch<void>(`/email-automations/${id}`, { method: 'DELETE', token });
}
