import { apiFetch } from './client';

export type ActivityType = 'call' | 'meeting' | 'task' | 'email';

export interface ApiActivity {
  id: string;
  type: ActivityType;
  subject: string;
  dueAt: string | null;
  done: boolean;
  dealId: string | null;
  personId: string | null;
}

export function getActivities(token: string) {
  return apiFetch<ApiActivity[]>('/activities', { token });
}

export function createActivity(
  token: string,
  body: { type: ActivityType; subject: string; dueAt?: string },
) {
  return apiFetch<ApiActivity>('/activities', { method: 'POST', token, body: JSON.stringify(body) });
}

export function completeActivity(token: string, id: string) {
  return apiFetch<ApiActivity>(`/activities/${id}/complete`, { method: 'POST', token });
}
