'use client';

import { Button, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { AuthCard } from '@/components/auth/AuthCard';

export default function ForgotPasswordPage() {
  const form = useForm({
    initialValues: { email: '' },
    validate: { email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email') },
  });

  const handleSubmit = form.onSubmit(() => {
    notifications.show({ message: 'If that email exists, a reset link was sent.' });
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
          <Button type="submit" fullWidth>
            Send reset link
          </Button>
          <Text c="dimmed" size="xs" ta="center">
            (UI only — wired to the API in a later step)
          </Text>
        </Stack>
      </form>
    </AuthCard>
  );
}
