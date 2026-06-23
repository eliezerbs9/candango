'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { AuthCard } from '@/components/auth/AuthCard';
import { useAuth } from '@/lib/auth/useAuth';
import { apiAcceptInvite } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export function AcceptInviteForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const token = useSearchParams().get('token') ?? '';
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { name: '', password: '', confirm: '' },
    validate: {
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
      confirm: (v, values) => (v === values.password ? null : 'Passwords do not match'),
    },
  });

  if (!token) {
    return (
      <AuthCard title="Invalid invite" footer={{ text: '', linkLabel: 'Back to sign in', href: '/login' }}>
        <Text c="dimmed" size="sm" ta="center">
          This invite link is missing its token. Ask your admin to resend the invite.
        </Text>
      </AuthCard>
    );
  }

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      const { token: jwt, user } = await apiAcceptInvite({
        token,
        password: values.password,
        name: values.name || undefined,
      });
      signIn(jwt, user);
      notifications.show({ message: 'Welcome to Candango!', color: 'green' });
      router.push('/dashboard');
    } catch (e) {
      notifications.show({
        message: e instanceof ApiError ? e.message : 'Could not accept invite',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthCard title="Accept your invite" subtitle="Set a password to join your team.">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput label="Your name" placeholder="Jane Doe" {...form.getInputProps('name')} />
          <PasswordInput label="Password" {...form.getInputProps('password')} />
          <PasswordInput label="Confirm password" {...form.getInputProps('confirm')} />
          <Button type="submit" fullWidth mt="xs" loading={loading}>
            Join team
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
