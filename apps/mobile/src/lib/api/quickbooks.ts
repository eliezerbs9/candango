/**
 * Deal estimates & invoices (QuickBooks billing). Mirrors apps/web/lib/api/quickbooks.ts.
 * Estimates work in "native" mode (offline); convert/send/link need QuickBooks connected.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { CreateDocInput, DealDoc } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';

export function useDealEstimates(dealId: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['estimates', dealId],
    queryFn: () => apiFetch<DealDoc[]>(`/deals/${dealId}/estimates`, { token: token! }),
    enabled: !!token && !!dealId,
  });
}

export function useDealInvoices(dealId: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['invoices', dealId],
    queryFn: () => apiFetch<DealDoc[]>(`/deals/${dealId}/invoices`, { token: token! }),
    enabled: !!token && !!dealId,
  });
}

/** Invalidate the estimates/invoices + the deal (value may change). */
function useBillingInvalidate(dealId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['estimates', dealId] });
    qc.invalidateQueries({ queryKey: ['invoices', dealId] });
    qc.invalidateQueries({ queryKey: ['deal', dealId] });
    qc.invalidateQueries({ queryKey: ['deals'] });
  };
}

export function useCreateEstimate(dealId: string) {
  const token = useAuthStore((s) => s.token);
  const invalidate = useBillingInvalidate(dealId);
  return useMutation({
    mutationFn: (body: CreateDocInput) =>
      apiFetch<DealDoc>(`/deals/${dealId}/estimates`, { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useUpdateEstimate(dealId: string) {
  const token = useAuthStore((s) => s.token);
  const invalidate = useBillingInvalidate(dealId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CreateDocInput }) =>
      apiFetch<DealDoc>(`/deals/${dealId}/estimates/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useSetEstimateStatus(dealId: string) {
  const token = useAuthStore((s) => s.token);
  const invalidate = useBillingInvalidate(dealId);
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<DealDoc>(`/deals/${dealId}/estimates/${id}/status`, { method: 'PATCH', token: token!, body: JSON.stringify({ status }) }),
    onSuccess: invalidate,
  });
}

export function useSetInvoiceStatus(dealId: string) {
  const token = useAuthStore((s) => s.token);
  const invalidate = useBillingInvalidate(dealId);
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<DealDoc>(`/deals/${dealId}/invoices/${id}/status`, { method: 'PATCH', token: token!, body: JSON.stringify({ status }) }),
    onSuccess: invalidate,
  });
}

export function useIncludeEstimatesInValue(dealId: string) {
  const token = useAuthStore((s) => s.token);
  const invalidate = useBillingInvalidate(dealId);
  return useMutation({
    mutationFn: ({ estimateIds, include }: { estimateIds: string[]; include: boolean }) =>
      apiFetch<{ value: number }>(`/deals/${dealId}/estimates/include-in-value`, {
        method: 'POST',
        token: token!,
        body: JSON.stringify({ estimateIds, include }),
      }),
    onSuccess: invalidate,
  });
}

export function useConvertToInvoice(dealId: string) {
  const token = useAuthStore((s) => s.token);
  const invalidate = useBillingInvalidate(dealId);
  return useMutation({
    mutationFn: (body: { estimateIds: string[]; memo?: string; status?: string }) =>
      apiFetch<DealDoc>(`/deals/${dealId}/invoices/from-estimates`, { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}
