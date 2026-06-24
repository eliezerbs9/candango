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
