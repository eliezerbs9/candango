/**
 * People + companies API hooks. Mirrors apps/web/lib/api/contacts.ts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { ApiCompany, ApiPerson } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';

export function usePersons() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['persons'],
    queryFn: () => apiFetch<ApiPerson[]>('/persons', { token: token! }),
    enabled: !!token,
  });
}

export function useCompanies() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<ApiCompany[]>('/companies', { token: token! }),
    enabled: !!token,
  });
}

export function useCreatePerson() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email?: string; phone?: string; companyIds?: string[] }) =>
      apiFetch<ApiPerson>('/persons', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useCreateCompany() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; domain?: string; phone?: string }) =>
      apiFetch<ApiCompany>('/companies', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}
