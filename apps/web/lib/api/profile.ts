import { apiFetch } from './client';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  orgId: string;
  orgName: string;
  role: string;
}

export function getMe(token: string) {
  return apiFetch<Profile>('/me', { token });
}

export function updateProfile(
  token: string,
  body: Partial<Pick<Profile, 'name' | 'phone' | 'avatarUrl'>>,
) {
  return apiFetch<Profile>('/me', { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function changePassword(
  token: string,
  body: { currentPassword: string; newPassword: string },
) {
  return apiFetch<{ ok: boolean }>('/me/password', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}
