'use client';

import { useState } from 'react';
import { Button, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { AuthCard } from '@/components/auth/AuthCard';
import { apiForgotPassword } from '@/lib/api/auth';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    initialValues: { email: '' },
    validate: { email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email') },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      await apiForgotPassword(values);
    } catch {
      // Intentionally ignored — we never reveal whether the email exists.
    } finally {
      setLoading(false);
      notifications.show({ message: 'If that email exists, a reset link was sent.' });
      form.reset();
    }
  });

  return (
    <AuthCard
      title="Reset password"
      subtitle="We'll email you a reset link."
      footer={{ text: 'Remembered it?', linkLabel: 'Back to sign in', href: '/login' }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput label="Email" placeholder="you@company.com" {...form.getInputProps('email')} />
          <Button type="submit" fullWidth loading={loading}>
            Send reset link
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
