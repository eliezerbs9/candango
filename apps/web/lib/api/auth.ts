import { apiFetch } from './client';
import type { AuthUser } from '@/lib/auth/store';

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function apiSignup(body: {
  orgName: string;
  name?: string;
  email: string;
  password: string;
}) {
  return apiFetch<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiLogin(body: { email: string; password: string }) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiMe(token: string) {
  return apiFetch<AuthUser>('/auth/me', { token });
}
