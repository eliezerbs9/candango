'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Divider, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/lib/auth/useAuth';
import { apiSignup, googleLoginUrl } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { OAuthButton } from './OAuthButton';

export function SignupForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { orgName: '', email: '', password: '' },
    validate: {
      orgName: (v) => (v.trim().length >= 2 ? null : 'Company name required'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      const { token, user } = await apiSignup(values);
      signIn(token, user);
      notifications.show({ message: 'Workspace created — 7-day trial started', color: 'green' });
      router.push('/onboarding');
    } catch (e) {
      notifications.show({
        message: e instanceof ApiError ? e.message : 'Sign-up failed',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <Stack gap="md">
      <OAuthButton onClick={() => { window.location.href = googleLoginUrl('signup'); }} />
      <Divider label="or" labelPosition="center" />
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput label="Company name" placeholder="Acme Inc." {...form.getInputProps('orgName')} />
          <TextInput label="Work email" placeholder="you@company.com" {...form.getInputProps('email')} />
          <PasswordInput label="Password" {...form.getInputProps('password')} />
          <Button type="submit" fullWidth mt="xs" loading={loading}>
            Start free trial
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
