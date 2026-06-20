'use client';

import { useAuthStore, type AuthUser } from './store';

export function useAuth() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);

  return {
    token,
    user,
    isAuthenticated: Boolean(token),
    signIn,
    signOut,
  };
}

/** Temporary mock used by UI-1 forms until the real API exists. */
export function mockUserFromEmail(email: string): AuthUser {
  const name = email.split('@')[0] || 'User';
  return { id: 'usr_mock', name, email, orgName: 'My Company' };
}
