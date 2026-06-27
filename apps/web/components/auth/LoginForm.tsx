'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Divider, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/lib/auth/useAuth';
import { apiLogin, apiMe, googleLoginUrl } from '@/lib/api/auth';
import { getOnboarding } from '@/lib/api/onboarding';
import { ApiError } from '@/lib/api/client';
import { OAuthButton } from './OAuthButton';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  // New workspaces (incl. Google sign-up) land on the onboarding wizard until it's completed.
  const routeAfterAuth = async (token: string) => {
    try {
      const ob = await getOnboarding(token);
      router.replace(ob.completed ? '/dashboard' : '/onboarding');
    } catch {
      router.replace('/dashboard');
    }
  };

  // Handle the return from "Sign in with Google" (the API redirects here with ?token / ?error).
  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');
    if (error) {
      notifications.show({
        color: 'red',
        message: error === 'google' ? 'Google sign-in failed. Please try again.' : 'Sign-in failed.',
      });
      router.replace('/login');
    } else if (token) {
      apiMe(token)
        .then((user) => {
          signIn(token, user);
          notifications.show({ message: 'Signed in', color: 'green' });
          return routeAfterAuth(token);
        })
        .catch(() => {
          notifications.show({ color: 'red', message: 'Sign-in failed.' });
          router.replace('/login');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      const { token, user } = await apiLogin(values);
      signIn(token, user);
      notifications.show({ message: 'Signed in', color: 'green' });
      await routeAfterAuth(token);
    } catch (e) {
      notifications.show({
        message: e instanceof ApiError ? e.message : 'Login failed',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <Stack gap="md">
      <OAuthButton onClick={() => { window.location.href = googleLoginUrl(); }} />
      <Divider label="or" labelPosition="center" />
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput label="Email" placeholder="you@company.com" {...form.getInputProps('email')} />
          <PasswordInput label="Password" {...form.getInputProps('password')} />
          <Button type="submit" fullWidth mt="xs" loading={loading}>
            Sign in
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
