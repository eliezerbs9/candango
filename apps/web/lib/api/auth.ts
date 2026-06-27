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

/** Full URL of the "Sign in with Google" entry point (a browser redirect, not fetch). */
/** `mode='signup'` creates a workspace when there's no account; `'login'` only signs in an existing one. */
export function googleLoginUrl(mode: 'login' | 'signup' = 'login') {
  return `${process.env.NEXT_PUBLIC_API_URL ?? '/v1'}/auth/google?mode=${mode}`;
}

export function apiForgotPassword(body: { email: string }) {
  return apiFetch<{ ok: true }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiResetPassword(body: { token: string; password: string }) {
  return apiFetch<{ ok: true }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiAcceptInvite(body: { token: string; password: string; name?: string }) {
  return apiFetch<AuthResponse>('/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiVerifyEmail(body: { token: string }) {
  return apiFetch<{ ok: true }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
