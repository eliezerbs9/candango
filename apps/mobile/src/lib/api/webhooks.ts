/**
 * Webhooks + deliveries. Mirrors apps/web/lib/api/webhooks.ts and the web
 * Settings → Webhooks page (/webhooks endpoints). The signing secret is
 * returned once on create.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

export interface Webhook {
  id: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CreatedWebhook extends Webhook {
  secret: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  status: 'success' | 'failed' | 'pending';
  attempt: number;
  responseCode: number | null;
  createdAt: string;
  payload: { type?: string } | null;
}

export function useWebhooks(enabled = true) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiFetch<Webhook[]>('/webhooks', { token: token! }),
    enabled: !!token && enabled,
  });
}

export function useCreateWebhook() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; eventTypes: string[] }) =>
      apiFetch<CreatedWebhook>('/webhooks', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useUpdateWebhook() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; isActive?: boolean; eventTypes?: string[] }) =>
      apiFetch<Webhook>(`/webhooks/${id}`, { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/webhooks/${id}`, { method: 'DELETE', token: token! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useWebhookDeliveries(webhookId: string | null) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => apiFetch<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`, { token: token! }),
    enabled: !!token && !!webhookId,
  });
}

export function usePingWebhook() {
  const token = useAuthStore((s) => s.token);
  return useMutation({
    mutationFn: (webhookId: string) =>
      apiFetch<{ ok: boolean }>(`/webhooks/${webhookId}/ping`, { method: 'POST', token: token! }),
  });
}

export function useReplayDelivery() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) =>
      apiFetch<{ ok: boolean }>(`/webhooks/deliveries/${deliveryId}/replay`, { method: 'POST', token: token! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-deliveries'] }),
  });
}
