import { apiFetch } from './client';

/** Public (unauthenticated) email-subscription status behind an unsubscribe link. */
export interface EmailPreference {
  email: string | null;
  workspaceName: string;
  subscribed: boolean;
}

export function getEmailPreference(token: string) {
  return apiFetch<EmailPreference>(`/public/email-preferences/${encodeURIComponent(token)}`);
}

export function setEmailPreference(token: string, subscribed: boolean) {
  return apiFetch<EmailPreference>(`/public/email-preferences/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ subscribed }),
  });
}
