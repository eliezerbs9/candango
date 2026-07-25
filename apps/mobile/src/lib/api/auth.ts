/**
 * Auth API calls against the Candango backend.
 * Mirrors the web: POST /auth/login → { token, user }; GET /auth/me → user.
 */
import { useMutation } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { AuthUser } from '@/lib/auth/store';

export type LoginBody = { email: string; password: string };
export type LoginResponse = { token: string; user: AuthUser };

export function login(body: LoginBody) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getMe(token: string) {
  return apiFetch<AuthUser>('/auth/me', { token });
}

export function useLogin() {
  return useMutation({ mutationFn: login });
}
