'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Anchor, Center, Loader, Stack, Text } from '@mantine/core';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { apiVerifyEmail } from '@/lib/api/auth';

type Status = 'pending' | 'success' | 'error';

export function VerifyEmail() {
  const token = useSearchParams().get('token') ?? '';
  const [status, setStatus] = useState<Status>('pending');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard React 18 StrictMode double-invoke (token is single-use)
    ran.current = true;
    if (!token) {
      setStatus('error');
      return;
    }
    apiVerifyEmail({ token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <AuthCard title="Email verification">
      {status === 'pending' ? (
        <Center>
          <Loader size="sm" />
        </Center>
      ) : (
        <Stack gap="sm" align="center">
          <Text size="sm" ta="center" c={status === 'success' ? undefined : 'red'}>
            {status === 'success'
              ? 'Your email is verified. Thanks!'
              : 'This verification link is invalid or has expired.'}
          </Text>
          <Anchor component={Link} href="/login" size="sm">
            Continue to sign in
          </Anchor>
        </Stack>
      )}
    </AuthCard>
  );
}
