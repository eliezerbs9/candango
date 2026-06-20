import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  orgId: string;
  orgName: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
};

/**
 * Auth store. Persisted to localStorage so a refresh keeps the session.
 * NOTE: UI-1 uses a mock token until the API (apps/api) lands; replace
 * `signIn` callers with real `/auth/login` once the backend exists.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      signIn: (token, user) => set({ token, user }),
      signOut: () => set({ token: null, user: null }),
    }),
    { name: 'candango-auth' },
  ),
);
