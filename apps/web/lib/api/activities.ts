import { apiFetch } from './client';
import type { ContactRef } from './contacts';

export type ActivityType = 'call' | 'meeting' | 'task' | 'email';
export type LocationType = 'in_person' | 'video' | 'phone' | 'none';

export interface ApiActivity {
  id: string;
  type: ActivityType;
  subject: string;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  locationType: LocationType | null;
  conferenceUrl: string | null;
  done: boolean;
  dealId: string | null;
  personId: string | null;
  assignedUserId: string | null;
  participants: ContactRef[];
  createdAt: string;
}

export interface ActivityFilters {
  dealId?: string;
  assignee?: string; // 'me' or a userId
  from?: string;
  to?: string;
  type?: ActivityType;
}

export interface ActivityBody {
  type: ActivityType;
  subject: string;
  dueAt?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  locationType?: LocationType;
  conferenceUrl?: string;
  dealId?: string;
  participantIds?: string[];
}

export function getActivities(token: string, filters: ActivityFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.dealId) qs.set('deal_id', filters.dealId);
  if (filters.assignee) qs.set('assignee', filters.assignee);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.type) qs.set('type', filters.type);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ApiActivity[]>(`/activities${suffix}`, { token });
}

export function createActivity(token: string, body: ActivityBody) {
  return apiFetch<ApiActivity>('/activities', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateActivity(token: string, id: string, body: Partial<ActivityBody> & { done?: boolean }) {
  return apiFetch<ApiActivity>(`/activities/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function completeActivity(token: string, id: string) {
  return apiFetch<ApiActivity>(`/activities/${id}/complete`, { method: 'POST', token });
}
