'use client';

import { useRouter } from 'next/navigation';
import { Button, Divider, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAuth, mockUserFromEmail } from '@/lib/auth/useAuth';
import { OAuthButton } from './OAuthButton';

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
    },
  });

  // Mock sign-in until apps/api exists (see lib/auth/store.ts).
  const handleSubmit = form.onSubmit((values) => {
    signIn('mock-token', mockUserFromEmail(values.email));
    notifications.show({ message: 'Signed in', color: 'green' });
    router.push('/dashboard');
  });

  const handleGoogle = () => {
    signIn('mock-google-token', mockUserFromEmail('you@gmail.com'));
    router.push('/dashboard');
  };

  return (
    <Stack gap="md">
      <OAuthButton onClick={handleGoogle} />
      <Divider label="or" labelPosition="center" />
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            placeholder="you@company.com"
            {...form.getInputProps('email')}
          />
          <PasswordInput label="Password" {...form.getInputProps('password')} />
          <Button type="submit" fullWidth mt="xs">
            Sign in
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
