/**
 * Billing status (READ-ONLY on mobile). Mirrors apps/web/lib/api/billing.ts.
 * Per Apple IAP rules the mobile app never starts checkout / opens the portal —
 * plan management stays on the web. Only GET /billing is used here.
 */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

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

export function useBilling() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['billing'],
    queryFn: () => apiFetch<BillingStatus>('/billing', { token: token! }),
    enabled: !!token,
  });
}
