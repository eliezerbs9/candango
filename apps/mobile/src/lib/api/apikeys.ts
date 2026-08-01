/**
 * API keys. Mirrors apps/web/lib/api/apikeys.ts and the web Settings → API Keys
 * page (/api-keys endpoints). The secret is returned once on create.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

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

export function useApiKeys(enabled = true) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiFetch<ApiKey[]>('/api-keys', { token: token! }),
    enabled: !!token && enabled,
  });
}

export function useCreateApiKey() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scopes: string[] }) =>
      apiFetch<CreatedApiKey>('/api-keys', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api-keys/${id}`, { method: 'DELETE', token: token! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}
