/**
 * Members + roles. Mirrors apps/web/lib/api/members.ts and the web
 * Settings → Members / Roles pages (/users, /roles endpoints).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

export interface ApiMember {
  id: string;
  name: string | null;
  email: string;
  roleId: string | null;
  role: string;
  status: 'active' | 'invited' | 'deactivated';
}

export interface ApiRole {
  id: string;
  name: string;
  visibility: 'own' | 'team' | 'org';
  isSystem: boolean;
  scopes: string[];
}

export interface ScopeOption {
  value: string;
  label: string;
}

export interface RoleBody {
  name: string;
  visibility: 'own' | 'team' | 'org';
  scopes: string[];
}

// --- Members ---

export function useUsers() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<ApiMember[]>('/users', { token: token! }),
    enabled: !!token,
  });
}

export function useInviteUser() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; name?: string; roleId?: string }) =>
      apiFetch<ApiMember>('/users/invite', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; roleId?: string; status?: string }) =>
      apiFetch<ApiMember>(`/users/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeactivateUser() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE', token: token! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// --- Roles ---

export function useRoles() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<ApiRole[]>('/roles', { token: token! }),
    enabled: !!token,
  });
}

export function useScopeCatalog() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['role-scopes'],
    queryFn: () => apiFetch<ScopeOption[]>('/roles/scopes', { token: token! }),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}

export function useCreateRole() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RoleBody) =>
      apiFetch<ApiRole>('/roles', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<RoleBody>) =>
      apiFetch<ApiRole>(`/roles/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useDeleteRole() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/roles/${id}`, { method: 'DELETE', token: token! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}
