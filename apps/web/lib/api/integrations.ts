import { apiFetch } from './client';

export interface ConnectionInfo {
  status: string;
  updatedAt: string;
}

export interface GoogleStatus {
  connected: boolean;
  calendar: ConnectionInfo | null;
  mailbox: ConnectionInfo | null;
}

export function getGoogleStatus(token: string) {
  return apiFetch<GoogleStatus>('/integrations/google', { token });
}

export function getGoogleConnectUrl(token: string) {
  return apiFetch<{ url: string }>('/integrations/google/connect', { token });
}

export function disconnectGoogle(token: string) {
  return apiFetch<void>('/integrations/google', { method: 'DELETE', token });
}

export function syncEmail(token: string) {
  return apiFetch<{ queued: boolean }>('/integrations/google/sync-email', { method: 'POST', token });
}

export interface QuickbooksStatus {
  connected: boolean;
  status: string;
  realmId: string | null;
  updatedAt: string | null;
}

export function getQuickbooksStatus(token: string) {
  return apiFetch<QuickbooksStatus>('/integrations/quickbooks', { token });
}

export function getQuickbooksConnectUrl(token: string) {
  return apiFetch<{ url: string }>('/integrations/quickbooks/connect', { token });
}

export function disconnectQuickbooks(token: string) {
  return apiFetch<void>('/integrations/quickbooks', { method: 'DELETE', token });
}

// --- CompanyCam (job-site photos) ---

export interface CompanyCamStatus {
  configured: boolean; // the deployment has COMPANYCAM_CLIENT_ID/SECRET set
  connected: boolean;
  status: string; // connected | reauth_required | disconnected
  connectedAt: string | null;
  lastRefreshAt: string | null;
  lastError: string | null;
}

export interface CompanyCamProject {
  id: string;
  name: string;
  address: string | null;
  photoCount: number | null;
}

export interface CompanyCamPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  capturedAt: string | null;
  creator: string | null;
}

export function getCompanyCamStatus(token: string) {
  return apiFetch<CompanyCamStatus>('/integrations/companycam', { token });
}

export function getCompanyCamConnectUrl(token: string) {
  return apiFetch<{ url: string }>('/integrations/companycam/connect', { token });
}

export function disconnectCompanyCam(token: string) {
  return apiFetch<void>('/integrations/companycam', { method: 'DELETE', token });
}

export function searchCompanyCamProjects(token: string, q: string) {
  return apiFetch<CompanyCamProject[]>(`/integrations/companycam/projects?q=${encodeURIComponent(q)}`, { token });
}

export function getDealCompanyCamLink(token: string, dealId: string) {
  return apiFetch<{ link: { projectId: string; projectName: string | null } | null }>(
    `/integrations/companycam/deals/${dealId}`,
    { token },
  );
}

export function getDealCompanyCamPhotos(token: string, dealId: string) {
  return apiFetch<{ photos: CompanyCamPhoto[] }>(`/integrations/companycam/deals/${dealId}/photos`, { token });
}

export function linkDealCompanyCamProject(token: string, dealId: string, body: { projectId: string; projectName?: string }) {
  return apiFetch<{ projectId: string; projectName: string | null }>(`/integrations/companycam/deals/${dealId}/link`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function unlinkDealCompanyCamProject(token: string, dealId: string) {
  return apiFetch<{ ok: boolean }>(`/integrations/companycam/deals/${dealId}/link`, { method: 'DELETE', token });
}

export function createDealCompanyCamProject(token: string, dealId: string) {
  return apiFetch<CompanyCamProject>(`/integrations/companycam/deals/${dealId}/project`, { method: 'POST', token });
}
