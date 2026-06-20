import { apiFetch } from './client';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKey {
  secret: string;
}

export function getApiKeys(token: string) {
  return apiFetch<ApiKey[]>('/api-keys', { token });
}

export function createApiKey(token: string, body: { name: string; scopes: string[] }) {
  return apiFetch<CreatedApiKey>('/api-keys', { method: 'POST', token, body: JSON.stringify(body) });
}

export function revokeApiKey(token: string, id: string) {
  return apiFetch<void>(`/api-keys/${id}`, { method: 'DELETE', token });
}
