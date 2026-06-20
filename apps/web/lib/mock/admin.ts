// Mock data for the Settings & Admin area (UI-3).

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Rep';
  status: 'active' | 'invited';
}

export const users: OrgUser[] = [
  { id: 'u1', name: 'You', email: 'you@company.com', role: 'Admin', status: 'active' },
  { id: 'u2', name: 'Sam Rivera', email: 'sam@company.com', role: 'Manager', status: 'active' },
  { id: 'u3', name: 'Alex Kim', email: 'alex@company.com', role: 'Rep', status: 'invited' },
];

export interface RoleRow {
  id: string;
  name: string;
  visibility: 'own' | 'team' | 'org';
  scopes: string[];
}

export const roles: RoleRow[] = [
  { id: 'r_admin', name: 'Admin', visibility: 'org', scopes: ['*'] },
  { id: 'r_manager', name: 'Manager', visibility: 'team', scopes: ['deals:write', 'persons:write', 'pipelines:manage', 'reports:read'] },
  { id: 'r_rep', name: 'Rep', visibility: 'own', scopes: ['deals:write', 'persons:write'] },
];

export const ALL_SCOPES = [
  'deals:read', 'deals:write', 'deals:delete', 'persons:read', 'persons:write',
  'pipelines:manage', 'reports:read', 'webhooks:manage', 'apikeys:manage',
  'billing:manage', 'branding:manage', 'integrations:manage',
];

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsed: string;
  scopes: string[];
}

export const apiKeys: ApiKeyRow[] = [
  { id: 'k1', name: 'Billing integration', prefix: 'sk_live_abc', lastUsed: '2026-06-19', scopes: ['deals:read'] },
  { id: 'k2', name: 'Data warehouse', prefix: 'sk_live_xyz', lastUsed: '2026-06-12', scopes: ['deals:read', 'persons:read'] },
];

export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

export const webhooks: WebhookRow[] = [
  { id: 'w1', url: 'https://hooks.acme.com/candango', events: ['deal.won', 'deal.stage_changed'], active: true },
];

export interface InvoiceRow {
  id: string;
  date: string;
  amount: number; // cents
  status: 'paid' | 'open';
}

export const invoices: InvoiceRow[] = [
  { id: 'in_1', date: '2026-05-20', amount: 9000, status: 'paid' },
  { id: 'in_2', date: '2026-04-20', amount: 9000, status: 'paid' },
];

export const subscription = {
  status: 'trialing' as const,
  seats: 3,
  pricePerSeat: 3000, // cents
  currency: 'USD',
  trialEndsAt: '2026-06-27',
};
