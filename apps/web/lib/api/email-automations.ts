import { apiFetch } from './client';

export interface EmailAutomation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  config: Record<string, unknown>;
  templateId: string;
  templateName: string | null;
  updatedAt: string;
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
}

export interface EmailAutomationBody {
  name?: string;
  trigger?: string;
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

export function createEmailAutomation(token: string, body: EmailAutomationBody) {
  return apiFetch<EmailAutomation>('/email-automations', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateEmailAutomation(token: string, id: string, body: EmailAutomationBody) {
  return apiFetch<EmailAutomation>(`/email-automations/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteEmailAutomation(token: string, id: string) {
  return apiFetch<void>(`/email-automations/${id}`, { method: 'DELETE', token });
}
