import { apiFetch } from './client';

export interface BillingInvoice {
  id: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  createdAt: string;
}

export interface BillingStatus {
  status: string; // trialing | active | past_due | canceled | locked
  seats: number;
  pricePerSeat: number;
  currency: string;
  monthlyTotal: number;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  hasSubscription: boolean;
  locked: boolean;
  invoices: BillingInvoice[];
}

export function getBilling(token: string) {
  return apiFetch<BillingStatus>('/billing', { token });
}

export function startCheckout(token: string) {
  return apiFetch<{ url: string }>('/billing/checkout', { method: 'POST', token });
}

export function openPortal(token: string) {
  return apiFetch<{ url: string }>('/billing/portal', { method: 'POST', token });
}
