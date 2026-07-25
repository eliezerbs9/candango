/**
 * Auth store — mirrors apps/web/lib/auth/store.ts, but persists the JWT to
 * the device secure enclave (expo-secure-store: Keychain on iOS, Keystore on
 * Android) instead of localStorage. Holds the real JWT + user from /auth/login.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  /** True until the persisted session has been rehydrated from secure storage. */
  hydrated: boolean;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
};

// Async storage adapter backed by the OS secure store.
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      signIn: (token, user) => set({ token, user }),
      signOut: () => set({ token: null, user: null }),
    }),
    {
      name: 'candango-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Flip `hydrated` once the async read completes so guards can wait.
        useAuthStore.setState({ hydrated: true });
        void state;
      },
    },
  ),
);
