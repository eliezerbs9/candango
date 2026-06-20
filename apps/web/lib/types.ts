// Shared domain types for Candango (mirrors the Data Model note / Prisma schema).
// Money is stored as integer minor units (cents) + a currency code.

export type ID = string;
export type DealStatus = 'open' | 'won' | 'lost';
export type ActivityType = 'call' | 'meeting' | 'task' | 'email';

export interface Pipeline {
  id: ID;
  name: string;
  isDefault: boolean;
}

export interface Stage {
  id: ID;
  pipelineId: ID;
  name: string;
  position: number;
  probability: number; // 0-100
}

export interface Company {
  id: ID;
  name: string;
  domain?: string;
}

export interface Person {
  id: ID;
  name: string;
  email?: string;
  companyId?: ID;
}

export interface Deal {
  id: ID;
  title: string;
  value: number; // cents
  currency: string;
  pipelineId: ID;
  stageId: ID;
  owner: string;
  personId?: ID;
  companyId?: ID;
  status: DealStatus;
  expectedCloseDate?: string;
  stageChangedAt: string;
}

export interface Activity {
  id: ID;
  type: ActivityType;
  subject: string;
  dueAt?: string;
  done: boolean;
  dealId?: ID;
}
