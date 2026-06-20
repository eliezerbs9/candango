import { apiFetch } from './client';

export interface ApiPerson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
}

export interface ApiCompany {
  id: string;
  name: string;
  domain: string | null;
}

export function getPersons(token: string) {
  return apiFetch<ApiPerson[]>('/persons', { token });
}

export function createPerson(
  token: string,
  body: { name: string; email?: string; phone?: string; companyId?: string },
) {
  return apiFetch<ApiPerson>('/persons', { method: 'POST', token, body: JSON.stringify(body) });
}

export function getCompanies(token: string) {
  return apiFetch<ApiCompany[]>('/companies', { token });
}

export function createCompany(token: string, body: { name: string; domain?: string }) {
  return apiFetch<ApiCompany>('/companies', { method: 'POST', token, body: JSON.stringify(body) });
}
