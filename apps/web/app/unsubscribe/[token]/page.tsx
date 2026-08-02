'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Center, Group, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconMailOff } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { getEmailPreference, setEmailPreference, type EmailPreference } from '@/lib/api/public-email';

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [pref, setPref] = useState<EmailPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getEmailPreference(token)
      .then((p) => active && setPref(p))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : 'This link is no longer valid.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  const change = (subscribed: boolean) => {
    setSaving(true);
    setError(null);
    setEmailPreference(token, subscribed)
      .then(setPref)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Something went wrong.'))
      .finally(() => setSaving(false));
  };

  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-gray-0)">
      <Card withBorder radius="lg" padding="xl" shadow="sm" maw={440} w="100%">
        {loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : error && !pref ? (
          <Stack gap="sm" align="center">
            <ThemeIcon variant="light" color="gray" size="xl" radius="xl">
              <IconMailOff size={24} />
            </ThemeIcon>
            <Text fw={600}>Link not valid</Text>
            <Text size="sm" c="dimmed" ta="center">
              {error}
            </Text>
          </Stack>
        ) : pref ? (
          <Stack gap="md" align="center">
            <ThemeIcon variant="light" color={pref.subscribed ? 'teal' : 'orange'} size="xl" radius="xl">
              {pref.subscribed ? <IconCheck size={24} /> : <IconMailOff size={24} />}
            </ThemeIcon>

            {pref.subscribed ? (
              <>
                <Text fw={600} ta="center">
                  Manage your email preferences
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  {pref.email ? <b>{pref.email}</b> : 'You'} {pref.email ? 'is' : 'are'} currently subscribed to
                  marketing emails from <b>{pref.workspaceName}</b>.
                </Text>
                <Button
                  color="orange"
                  leftSection={<IconMailOff size={16} />}
                  loading={saving}
                  onClick={() => change(false)}
                  fullWidth
                >
                  Unsubscribe
                </Button>
              </>
            ) : (
              <>
                <Text fw={600} ta="center">
                  You&apos;re unsubscribed
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  {pref.email ? <b>{pref.email}</b> : 'You'} will no longer receive marketing emails from{' '}
                  <b>{pref.workspaceName}</b>. You may still receive transactional messages (like estimates and
                  invoices).
                </Text>
                <Button variant="light" loading={saving} onClick={() => change(true)} fullWidth>
                  Re-subscribe
                </Button>
              </>
            )}

            {error && (
              <Text size="xs" c="red" ta="center">
                {error}
              </Text>
            )}
          </Stack>
        ) : null}

        <Group justify="center" mt="lg">
          <Text size="xs" c="dimmed">
            Powered by Candango
          </Text>
        </Group>
      </Card>
    </Center>
  );
}
