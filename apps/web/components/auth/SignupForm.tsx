'use client';

import { useRouter } from 'next/navigation';
import { Button, Divider, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAuth, mockUserFromEmail } from '@/lib/auth/useAuth';
import { OAuthButton } from './OAuthButton';

export function SignupForm() {
  const router = useRouter();
  const { signIn } = useAuth();

  const form = useForm({
    initialValues: { orgName: '', email: '', password: '' },
    validate: {
      orgName: (v) => (v.trim().length >= 2 ? null : 'Company name required'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
    },
  });

  // Mock provisioning until apps/api exists; routes into onboarding.
  const handleSubmit = form.onSubmit((values) => {
    const user = { ...mockUserFromEmail(values.email), orgName: values.orgName };
    signIn('mock-token', user);
    notifications.show({ message: 'Workspace created — 7-day trial started', color: 'green' });
    router.push('/onboarding');
  });

  const handleGoogle = () => {
    signIn('mock-google-token', mockUserFromEmail('you@gmail.com'));
    router.push('/onboarding');
  };

  return (
    <Stack gap="md">
      <OAuthButton onClick={handleGoogle} />
      <Divider label="or" labelPosition="center" />
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Company name"
            placeholder="Acme Inc."
            {...form.getInputProps('orgName')}
          />
          <TextInput label="Work email" placeholder="you@company.com" {...form.getInputProps('email')} />
          <PasswordInput label="Password" {...form.getInputProps('password')} />
          <Button type="submit" fullWidth mt="xs">
            Start free trial
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
