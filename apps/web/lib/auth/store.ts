import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  orgId: string;
  orgName: string;
  role?: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
};

/**
 * Auth store. Persisted to localStorage so a refresh keeps the session.
 * Holds the real JWT + user from `/auth/login` / `/auth/signup` / accept-invite.
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
