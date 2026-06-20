'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Divider, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/lib/auth/useAuth';
import { apiLogin } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { OAuthButton } from './OAuthButton';

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

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
      router.push('/dashboard');
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
      <OAuthButton onClick={() => notifications.show({ message: 'Google sign-in coming soon' })} />
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
