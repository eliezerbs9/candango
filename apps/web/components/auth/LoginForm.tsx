'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Divider, PasswordInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/lib/auth/useAuth';
import { apiLogin, apiMe, googleLoginUrl, type WorkspaceChoice } from '@/lib/api/auth';
import { getOnboarding } from '@/lib/api/onboarding';
import { ApiError } from '@/lib/api/client';
import { OAuthButton } from './OAuthButton';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  // Mobile mode: the native app opens this page with `?platform=mobile&redirect=
  // candango://auth`. Instead of signing into the web app, we hand the JWT back
  // to the app via that deep link (the "single Log in button" pattern).
  const mobileRedirect = params.get('platform') === 'mobile' ? params.get('redirect') : null;
  const finishMobile = (token: string) => {
    const sep = mobileRedirect!.includes('?') ? '&' : '?';
    window.location.href = `${mobileRedirect}${sep}token=${encodeURIComponent(token)}`;
  };

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
        message:
          error === 'google_exists'
            ? 'That email already has a Candango account — sign in instead of signing up.'
            : error === 'google'
              ? "Google sign-in failed — no account for that email. Sign up first, or check it's verified."
              : 'Sign-in failed.',
      });
      router.replace('/login');
    } else if (token) {
      if (mobileRedirect) {
        finishMobile(token);
        return;
      }
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

  // When an email exists in multiple workspaces, the API returns a list to pick from.
  const [workspaces, setWorkspaces] = useState<WorkspaceChoice[] | null>(null);
  const [chosenOrg, setChosenOrg] = useState<string | null>(null);

  const doLogin = async (orgId?: string) => {
    setLoading(true);
    try {
      const res = await apiLogin({ ...form.values, ...(orgId ? { orgId } : {}) });
      if ('needsWorkspace' in res) {
        setWorkspaces(res.workspaces);
        setChosenOrg(res.workspaces[0]?.orgId ?? null);
        return;
      }
      const { token, user } = res;
      if (mobileRedirect) {
        finishMobile(token); // hand the token to the mobile app, don't sign into the web
        return;
      }
      signIn(token, user);
      notifications.show({ message: 'Signed in', color: 'green' });
      await routeAfterAuth(token);
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Login failed', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = form.onSubmit(() => doLogin());

  return (
    <Stack gap="md">
      <OAuthButton
        onClick={() => {
          window.location.href = googleLoginUrl('login', mobileRedirect ? { redirect: mobileRedirect } : undefined);
        }}
      />
      <Divider label="or" labelPosition="center" />
      {workspaces ? (
        <Stack gap="sm">
          <Text size="sm">This email is in more than one workspace. Choose which to sign into:</Text>
          <Select
            label="Workspace"
            data={workspaces.map((w) => ({ value: w.orgId, label: w.orgName }))}
            value={chosenOrg}
            onChange={setChosenOrg}
            allowDeselect={false}
          />
          <Button fullWidth loading={loading} disabled={!chosenOrg} onClick={() => chosenOrg && doLogin(chosenOrg)}>
            Continue
          </Button>
          <Button variant="subtle" size="xs" onClick={() => setWorkspaces(null)}>
            Use a different email
          </Button>
        </Stack>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput label="Email" placeholder="you@company.com" {...form.getInputProps('email')} />
            <PasswordInput label="Password" {...form.getInputProps('password')} />
            <Button type="submit" fullWidth mt="xs" loading={loading}>
              Sign in
            </Button>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
