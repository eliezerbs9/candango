import { apiFetch } from './client';
import type { Address } from './types';

export interface ContactRef {
  id: string;
  name: string;
  /** For a company's contacts: the person's role at that company. */
  title?: string;
}

export interface ApiPerson {
  id: string;
  name: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: Address | null;
  tags: string[];
  emailSubscribed: boolean;
  emailUnsubscribedAt: string | null;
  companies: ContactRef[];
  customFields: Record<string, unknown>;
}

export interface ApiCompany {
  id: string;
  name: string;
  domain: string | null;
  address: Address | null;
  phone: string | null;
  primaryContactId: string | null;
  tags: string[];
  contacts: ContactRef[];
  customFields: Record<string, unknown>;
}

/** A deal as summarised on a contact/company detail view. */
export interface ContactDeal {
  id: string;
  refNumber: number | null;
  title: string;
  value: number;
  currency: string;
  status: string;
  stageName: string | null;
}

/** A message as summarised on a contact/company detail view. */
export interface ContactMessage {
  id: string;
  direction: string;
  subject: string | null;
  snippet: string | null;
  fromAddress: string;
  at: string;
  dealId: string | null;
}

/** An estimate or invoice across a contact's deals. */
export interface ContactDocument {
  id: string;
  kind: 'estimate' | 'invoice';
  docNumber: string | null;
  status: string;
  total: number;
  currency: string;
  at: string;
  dealId: string;
  dealTitle: string | null;
}

export interface ApiPersonDetail extends ApiPerson {
  /** QuickBooks customer id (when linked). */
  qbCustomerId: string | null;
  deals: ContactDeal[];
  documents: ContactDocument[];
  messages: ContactMessage[];
}

export interface ApiCompanyDetail extends ApiCompany {
  qbCustomerId: string | null;
  deals: ContactDeal[];
  documents: ContactDocument[];
  messages: ContactMessage[];
}

export interface PersonBody {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: Address;
  companyIds?: string[];
  tags?: string[];
  emailSubscribed?: boolean;
  customFields?: Record<string, unknown>;
}

export interface CompanyBody {
  name: string;
  domain?: string;
  address?: Address;
  phone?: string;
  contactIds?: string[];
  contactTitles?: Record<string, string>;
  primaryContactId?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export function getPersons(token: string) {
  return apiFetch<ApiPerson[]>('/persons', { token });
}

export function getPersonDetail(token: string, id: string) {
  return apiFetch<ApiPersonDetail>(`/persons/${id}/detail`, { token });
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

export function getCompanyDetail(token: string, id: string) {
  return apiFetch<ApiCompanyDetail>(`/companies/${id}/detail`, { token });
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
