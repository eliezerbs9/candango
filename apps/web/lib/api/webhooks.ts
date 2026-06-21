import { apiFetch } from './client';

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

export function getWebhooks(token: string) {
  return apiFetch<Webhook[]>('/webhooks', { token });
}

export function createWebhook(token: string, body: { url: string; eventTypes: string[] }) {
  return apiFetch<CreatedWebhook>('/webhooks', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateWebhook(
  token: string,
  id: string,
  body: { isActive?: boolean; eventTypes?: string[] },
) {
  return apiFetch<Webhook>(`/webhooks/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteWebhook(token: string, id: string) {
  return apiFetch<void>(`/webhooks/${id}`, { method: 'DELETE', token });
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

export function getDeliveries(token: string, webhookId: string) {
  return apiFetch<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`, { token });
}

export function pingWebhook(token: string, webhookId: string) {
  return apiFetch<{ ok: boolean }>(`/webhooks/${webhookId}/ping`, { method: 'POST', token });
}

export function replayDelivery(token: string, deliveryId: string) {
  return apiFetch<{ ok: boolean }>(`/webhooks/deliveries/${deliveryId}/replay`, { method: 'POST', token });
}
