/**
 * Personal profile + password. Mirrors apps/web/lib/api/profile.ts
 * (GET/PATCH /me, POST /me/password) and the web Settings → Profile page.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

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

export function useProfile() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<Profile>('/me', { token: token! }),
    enabled: !!token,
  });
}

export function useUpdateProfile() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<Profile, 'name' | 'phone' | 'avatarUrl'>>) =>
      apiFetch<Profile>('/me', { method: 'PATCH', token: token!, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useChangePassword() {
  const token = useAuthStore((s) => s.token);
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiFetch<{ ok: boolean }>('/me/password', {
        method: 'POST',
        token: token!,
        body: JSON.stringify(body),
      }),
  });
}
