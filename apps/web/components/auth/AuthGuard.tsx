'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader } from '@mantine/core';
import { useAuthStore } from '@/lib/auth/store';

/**
 * Client-side guard for the protected (app) group. Waits for the persisted
 * store to hydrate to avoid a redirect flash, then sends unauthenticated
 * users to /login. The server still enforces auth in production.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace('/login');
    }
  }, [hydrated, token, router]);

  if (!hydrated || !token) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    );
  }

  return <>{children}</>;
}
