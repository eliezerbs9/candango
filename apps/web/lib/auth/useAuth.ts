'use client';

import { useAuthStore } from './store';

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
