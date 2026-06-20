// In-memory mock data for UI development. Replace with TanStack Query hooks
// hitting the real API (apps/api) once the backend exists.

import type { Activity, Company, Deal, Person, Pipeline, Stage } from '@/lib/types';

export const pipelines: Pipeline[] = [
  { id: 'pl_new', name: 'New Business', isDefault: true },
  { id: 'pl_renew', name: 'Renewals', isDefault: false },
];

export const stages: Stage[] = [
  { id: 'st_lead', pipelineId: 'pl_new', name: 'Lead', position: 0, probability: 10 },
  { id: 'st_qual', pipelineId: 'pl_new', name: 'Qualified', position: 1, probability: 30 },
  { id: 'st_prop', pipelineId: 'pl_new', name: 'Proposal', position: 2, probability: 60 },
  { id: 'st_nego', pipelineId: 'pl_new', name: 'Negotiation', position: 3, probability: 80 },
  { id: 'st_r_due', pipelineId: 'pl_renew', name: 'Up for renewal', position: 0, probability: 50 },
  { id: 'st_r_sent', pipelineId: 'pl_renew', name: 'Quote sent', position: 1, probability: 70 },
];

export const companies: Company[] = [
  { id: 'co_acme', name: 'Acme Inc.', domain: 'acme.com' },
  { id: 'co_globex', name: 'Globex', domain: 'globex.com' },
  { id: 'co_initech', name: 'Initech', domain: 'initech.com' },
];

export const persons: Person[] = [
  { id: 'pe_jane', name: 'Jane Cooper', email: 'jane@acme.com', companyId: 'co_acme' },
  { id: 'pe_wade', name: 'Wade Warren', email: 'wade@globex.com', companyId: 'co_globex' },
  { id: 'pe_esther', name: 'Esther Howard', email: 'esther@initech.com', companyId: 'co_initech' },
];

export const deals: Deal[] = [
  { id: 'de_1', title: 'Acme — 50 seats', value: 500000, currency: 'USD', pipelineId: 'pl_new', stageId: 'st_qual', owner: 'You', personId: 'pe_jane', companyId: 'co_acme', status: 'open', expectedCloseDate: '2026-07-15', stageChangedAt: '2026-06-10' },
  { id: 'de_2', title: 'Globex rollout', value: 1200000, currency: 'USD', pipelineId: 'pl_new', stageId: 'st_prop', owner: 'You', personId: 'pe_wade', companyId: 'co_globex', status: 'open', expectedCloseDate: '2026-08-01', stageChangedAt: '2026-06-05' },
  { id: 'de_3', title: 'Initech pilot', value: 250000, currency: 'USD', pipelineId: 'pl_new', stageId: 'st_lead', owner: 'You', personId: 'pe_esther', companyId: 'co_initech', status: 'open', expectedCloseDate: '2026-07-30', stageChangedAt: '2026-06-18' },
  { id: 'de_4', title: 'Acme expansion', value: 800000, currency: 'USD', pipelineId: 'pl_new', stageId: 'st_nego', owner: 'You', personId: 'pe_jane', companyId: 'co_acme', status: 'open', expectedCloseDate: '2026-06-28', stageChangedAt: '2026-06-01' },
];

export const activities: Activity[] = [
  { id: 'ac_1', type: 'call', subject: 'Discovery call with Jane', dueAt: '2026-06-21', done: false, dealId: 'de_1' },
  { id: 'ac_2', type: 'meeting', subject: 'Demo for Globex', dueAt: '2026-06-22', done: false, dealId: 'de_2' },
  { id: 'ac_3', type: 'task', subject: 'Send proposal to Initech', dueAt: '2026-06-20', done: true, dealId: 'de_3' },
  { id: 'ac_4', type: 'email', subject: 'Follow up on Acme expansion', dueAt: '2026-06-23', done: false, dealId: 'de_4' },
];

// Helpers
export const stagesByPipeline = (pipelineId: string) =>
  stages.filter((s) => s.pipelineId === pipelineId).sort((a, b) => a.position - b.position);
export const dealsByPipeline = (pipelineId: string) =>
  deals.filter((d) => d.pipelineId === pipelineId);
export const companyName = (id?: string) => companies.find((c) => c.id === id)?.name ?? '—';
export const personName = (id?: string) => persons.find((p) => p.id === id)?.name ?? '—';
