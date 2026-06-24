import { apiFetch } from './client';

export interface ContactRef {
  id: string;
  name: string;
}

export interface ApiPerson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  companies: ContactRef[];
  customFields: Record<string, unknown>;
}

export interface ApiCompany {
  id: string;
  name: string;
  domain: string | null;
  address: string | null;
  phone: string | null;
  contacts: ContactRef[];
  customFields: Record<string, unknown>;
}

export interface PersonBody {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  companyIds?: string[];
  customFields?: Record<string, unknown>;
}

export interface CompanyBody {
  name: string;
  domain?: string;
  address?: string;
  phone?: string;
  contactIds?: string[];
  customFields?: Record<string, unknown>;
}

export function getPersons(token: string) {
  return apiFetch<ApiPerson[]>('/persons', { token });
}

export function createPerson(token: string, body: PersonBody) {
  return apiFetch<ApiPerson>('/persons', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updatePerson(token: string, id: string, body: Partial<PersonBody>) {
  return apiFetch<ApiPerson>(`/persons/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deletePerson(token: string, id: string) {
  return apiFetch<void>(`/persons/${id}`, { method: 'DELETE', token });
}

export function getCompanies(token: string) {
  return apiFetch<ApiCompany[]>('/companies', { token });
}

export function createCompany(token: string, body: CompanyBody) {
  return apiFetch<ApiCompany>('/companies', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateCompany(token: string, id: string, body: Partial<CompanyBody>) {
  return apiFetch<ApiCompany>(`/companies/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteCompany(token: string, id: string) {
  return apiFetch<void>(`/companies/${id}`, { method: 'DELETE', token });
}
