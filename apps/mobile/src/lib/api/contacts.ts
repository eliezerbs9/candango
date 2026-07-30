/**
 * People + companies API hooks. Mirrors apps/web/lib/api/contacts.ts.
 * Person↔company links are bidirectional, so every mutation invalidates both
 * ['persons'] and ['companies'].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { ApiCompany, ApiPerson, CompanyBody, PersonBody } from '@/lib/api/types';
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

/** Invalidate both contact lists after any person/company mutation. */
function useContactsInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['persons'] });
    qc.invalidateQueries({ queryKey: ['companies'] });
  };
}

export function useCreatePerson() {
  const token = useAuthStore((s) => s.token);
  const invalidate = useContactsInvalidate();
  return useMutation({
    mutationFn: (body: PersonBody) =>
      apiFetch<ApiPerson>('/persons', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useUpdatePerson() {
  const token = useAuthStore((s) => s.token);
  const invalidate = useContactsInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<PersonBody>) =>
      apiFetch<ApiPerson>(`/persons/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useDeletePerson() {
  const token = useAuthStore((s) => s.token);
  const invalidate = useContactsInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/persons/${id}`, { method: 'DELETE', token: token! }),
    onSuccess: invalidate,
  });
}

export function useCreateCompany() {
  const token = useAuthStore((s) => s.token);
  const invalidate = useContactsInvalidate();
  return useMutation({
    mutationFn: (body: CompanyBody) =>
      apiFetch<ApiCompany>('/companies', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useUpdateCompany() {
  const token = useAuthStore((s) => s.token);
  const invalidate = useContactsInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<CompanyBody>) =>
      apiFetch<ApiCompany>(`/companies/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useDeleteCompany() {
  const token = useAuthStore((s) => s.token);
  const invalidate = useContactsInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/companies/${id}`, { method: 'DELETE', token: token! }),
    onSuccess: invalidate,
  });
}
