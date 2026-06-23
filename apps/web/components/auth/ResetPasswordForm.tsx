'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, PasswordInput, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { AuthCard } from '@/components/auth/AuthCard';
import { apiResetPassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { password: '', confirm: '' },
    validate: {
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
      confirm: (v, values) => (v === values.password ? null : 'Passwords do not match'),
    },
  });

  if (!token) {
    return (
      <AuthCard title="Invalid link" footer={{ text: '', linkLabel: 'Request a new link', href: '/forgot-password' }}>
        <Text c="dimmed" size="sm" ta="center">
          This reset link is missing its token. Request a new one.
        </Text>
      </AuthCard>
    );
  }

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      await apiResetPassword({ token, password: values.password });
      notifications.show({ message: 'Password updated — sign in with your new password.', color: 'green' });
      router.push('/login');
    } catch (e) {
      notifications.show({
        message: e instanceof ApiError ? e.message : 'Could not reset password',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthCard
      title="Choose a new password"
      footer={{ text: 'Remembered it?', linkLabel: 'Back to sign in', href: '/login' }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <PasswordInput label="New password" {...form.getInputProps('password')} />
          <PasswordInput label="Confirm password" {...form.getInputProps('confirm')} />
          <Button type="submit" fullWidth mt="xs" loading={loading}>
            Update password
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
