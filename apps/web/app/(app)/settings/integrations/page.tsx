'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandGoogle, IconInfoCircle, IconReceipt } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useConnectGoogle,
  useConnectQuickbooks,
  useDisconnectGoogle,
  useDisconnectQuickbooks,
  useGoogleStatus,
  useQuickbooksStatus,
} from '@/lib/api/hooks';

/** Shows a toast for ?google=…/?quickbooks=… set by the OAuth callback redirect, then cleans the URL.
 *  `redirectTo` (used for QuickBooks): after a successful connect, send the user there after 5s so they
 *  can review their imported items and decide on tax. */
function useOAuthResultToast(param: string, label: string, redirectTo?: string) {
  const router = useRouter();
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get(param);
    if (!result) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (result !== 'connected') {
      notifications.show({ message: `${label} connection failed — please try again`, color: 'red' });
      return;
    }
    if (!redirectTo) {
      notifications.show({ message: `${label} connected`, color: 'green' });
      return;
    }
    notifications.show({
      message: `${label} connected — taking you to Invoicing settings to review your items and tax…`,
      color: 'green',
      autoClose: 5000,
    });
    const t = setTimeout(() => router.push(redirectTo), 5000);
    return () => clearTimeout(t);
  }, [param, label, redirectTo, router]);
}

function GoogleCard() {
  const { data: status, isLoading } = useGoogleStatus();
  const connect = useConnectGoogle();
  const disconnect = useDisconnectGoogle();
  const connected = !!status?.connected;
  useOAuthResultToast('google', 'Google');

  const onConnect = async () => {
    try {
      const { url } = await connect.mutateAsync();
      window.location.href = url;
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not start', color: 'red' });
    }
  };

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="xs">
        <Group gap="sm">
          <IconBrandGoogle size={20} />
          <Text fw={600}>Google</Text>
        </Group>
        <Badge color={connected ? 'green' : 'gray'} variant="light">
          {connected ? 'Connected' : 'Not connected'}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Sync meetings with Google Calendar and capture email per salesperson.
      </Text>
      {connected ? (
        <Button variant="default" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
          Disconnect
        </Button>
      ) : (
        <Button loading={connect.isPending || isLoading} onClick={onConnect}>
          Connect
        </Button>
      )}
    </Card>
  );
}

function QuickbooksCard() {
  const { data: status, isLoading } = useQuickbooksStatus();
  const connect = useConnectQuickbooks();
  const disconnect = useDisconnectQuickbooks();
  const connected = !!status?.connected;
  useOAuthResultToast('quickbooks', 'QuickBooks', '/settings/invoicing');

  const onConnect = async () => {
    try {
      const { url } = await connect.mutateAsync();
      window.location.href = url;
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not start', color: 'red' });
    }
  };

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="xs">
        <Group gap="sm">
          <IconReceipt size={20} />
          <Text fw={600}>QuickBooks</Text>
        </Group>
        <Badge color={connected ? 'green' : status?.status === 'reauth_required' ? 'orange' : 'gray'} variant="light">
          {connected ? 'Connected' : status?.status === 'reauth_required' ? 'Reconnect needed' : 'Not connected'}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Map deals to QuickBooks jobs; estimates set deal value, won deals create invoices.
      </Text>
      {connected ? (
        <Button variant="default" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
          Disconnect
        </Button>
      ) : (
        <Button loading={connect.isPending || isLoading} onClick={onConnect}>
          Connect
        </Button>
      )}
    </Card>
  );
}

export default function IntegrationsPage() {
  return (
    <Stack>
      <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />}>
        Full email sync is pending.
      </Alert>
      <Text c="dimmed" size="sm">
        Optional integrations. The app works fully without them.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <GoogleCard />
        <QuickbooksCard />
      </SimpleGrid>
    </Stack>
  );
}
