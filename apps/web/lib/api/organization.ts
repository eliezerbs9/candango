import { apiFetch } from './client';

export type QboNameFormat = 'first_last' | 'last_first';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  qboNameFormat: QboNameFormat;
  taxRateBps: number;
  taxDefaultOn: boolean;
  onboardingState: Record<string, unknown>;
  createdAt: string;
}

export interface OrganizationBody {
  name?: string;
  logoUrl?: string;
  qboNameFormat?: QboNameFormat;
  taxRateBps?: number;
  taxDefaultOn?: boolean;
}

export function getOrganization(token: string) {
  return apiFetch<Organization>('/organization', { token });
}

export function updateOrganization(token: string, body: OrganizationBody) {
  return apiFetch<Organization>('/organization', { method: 'PATCH', token, body: JSON.stringify(body) });
}
