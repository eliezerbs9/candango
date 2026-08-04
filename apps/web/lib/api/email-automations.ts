import { apiFetch } from './client';

export type AutomationAction = 'send_email' | 'create_activity' | 'request_signature';

export type AutomationKind = 'deal' | 'marketing';

export interface EmailAutomation {
  id: string;
  name: string;
  enabled: boolean;
  kind: AutomationKind;
  category: string;
  tags: string[];
  trigger: string;
  action: AutomationAction;
  config: Record<string, unknown>;
  templateId: string | null;
  templateName: string | null;
  timezone: string | null;
  startAt: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  updatedAt: string;
}

// ── Marketing schedule + audience (mirror of the API's marketing-schedule/-audience.ts) ──
export type ScheduleType = 'daily' | 'weekly' | 'monthly_date' | 'monthly_weekday' | 'once';

export interface MarketingSchedule {
  type: ScheduleType;
  atTime?: string;
  everyDays?: number;
  daysOfWeek?: number[];
  everyWeeks?: number;
  dayOfMonth?: number;
  week?: number | 'last';
  weekday?: number;
  date?: string;
}

export type AudienceType = 'label' | 'deal_stage' | 'all' | 'filter';

export interface MarketingAudience {
  type: AudienceType;
  tags?: string[];
  stageId?: string;
  filter?: { tagsAny?: string[]; tagsAll?: string[]; companyId?: string };
}

export interface MarketingAutomationBody {
  name?: string;
  category?: string;
  tags?: string[];
  templateId?: string;
  timezone?: string;
  startAt?: string;
  schedule?: MarketingSchedule;
  audience?: MarketingAudience;
  enabled?: boolean;
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

export function createMarketingAutomation(token: string, body: MarketingAutomationBody) {
  return apiFetch<EmailAutomation>('/email-automations/marketing', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function updateMarketingAutomation(token: string, id: string, body: MarketingAutomationBody) {
  return apiFetch<EmailAutomation>(`/email-automations/marketing/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export function previewAudience(token: string, audience: MarketingAudience) {
  return apiFetch<{ count: number }>('/email-automations/marketing/audience-preview', {
    method: 'POST',
    token,
    body: JSON.stringify({ audience }),
  });
}
