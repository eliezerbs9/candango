import { apiFetch } from './client';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  onboardingState: Record<string, unknown>;
  createdAt: string;
}

export function getOrganization(token: string) {
  return apiFetch<Organization>('/organization', { token });
}

export function updateOrganization(token: string, body: { name?: string; logoUrl?: string }) {
  return apiFetch<Organization>('/organization', { method: 'PATCH', token, body: JSON.stringify(body) });
}
