import { apiFetch } from './client';
import type { DealCardConfig } from './types';

export type QboNameFormat = 'first_last' | 'last_first';

/** Rules that gate the deal "Mark won" button (global). Empty / disabled = "Any time". */
export interface WinRequirements {
  enabled?: boolean;
  stageIds?: string[];
  requireAcceptedProposal?: boolean;
  requireSignedDocument?: boolean;
  signedTemplateIds?: string[];
  requireInvoice?: boolean; // only offered/enforced while QuickBooks is connected
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  qboNameFormat: QboNameFormat;
  timezone: string | null; // IANA workspace timezone
  taxRateBps: number;
  taxDefaultOn: boolean;
  emailSignature: string; // HTML with sender/company {{variables}}
  winRequirements: WinRequirements;
  dealCardConfig: DealCardConfig;
  onboardingState: Record<string, unknown>;
  createdAt: string;
}

export interface OrganizationBody {
  name?: string;
  logoUrl?: string;
  qboNameFormat?: QboNameFormat;
  timezone?: string;
  taxRateBps?: number;
  taxDefaultOn?: boolean;
  emailSignature?: string;
  winRequirements?: WinRequirements;
  dealCardConfig?: DealCardConfig;
}

export function getOrganization(token: string) {
  return apiFetch<Organization>('/organization', { token });
}

export function updateOrganization(token: string, body: OrganizationBody) {
  return apiFetch<Organization>('/organization', { method: 'PATCH', token, body: JSON.stringify(body) });
}
