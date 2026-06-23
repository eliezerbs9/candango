import { apiFetch } from './client';

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

export function getUsers(token: string) {
  return apiFetch<ApiMember[]>('/users', { token });
}

export function inviteUser(token: string, body: { email: string; name?: string; roleId?: string }) {
  return apiFetch<ApiMember>('/users/invite', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateUser(token: string, id: string, body: { roleId?: string; status?: string }) {
  return apiFetch<ApiMember>(`/users/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deactivateUser(token: string, id: string) {
  return apiFetch<void>(`/users/${id}`, { method: 'DELETE', token });
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

export function getRoles(token: string) {
  return apiFetch<ApiRole[]>('/roles', { token });
}

export function getScopeCatalog(token: string) {
  return apiFetch<ScopeOption[]>('/roles/scopes', { token });
}

export function createRole(token: string, body: RoleBody) {
  return apiFetch<ApiRole>('/roles', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateRole(token: string, id: string, body: Partial<RoleBody>) {
  return apiFetch<ApiRole>(`/roles/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteRole(token: string, id: string) {
  return apiFetch<void>(`/roles/${id}`, { method: 'DELETE', token });
}
