/**
 * People + companies API hooks. Mirrors apps/web/lib/api/contacts.ts.
 */
import { useQuery } from '@tanstack/react-query';

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
