'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Text } from '@mantine/core';
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

/** Shows a toast for ?google=… set by the OAuth callback redirect, then cleans the URL. */
function useOAuthResultToast(param: string, label: string) {
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get(param);
    if (!result) return;
    notifications.show(
      result === 'connected'
        ? { message: `${label} connected`, color: 'green' }
        : { message: `${label} connection failed — please try again`, color: 'red' },
    );
    window.history.replaceState(null, '', window.location.pathname);
  }, [param, label]);
}

/**
 * After the QuickBooks OAuth callback returns (?quickbooks=connected), show a modal
 * with a 5s countdown and take the user to Invoicing settings to review their
 * imported items and set sales tax. Reads the param once (StrictMode-safe).
 */
function QbConnectRedirect() {
  const router = useRouter();
  const processed = useRef(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (processed.current) return;
    const result = new URLSearchParams(window.location.search).get('quickbooks');
    if (!result) return;
    processed.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    if (result === 'connected') setCount(5);
    else notifications.show({ message: 'QuickBooks connection failed — please try again', color: 'red' });
  }, []);

  useEffect(() => {
    if (count == null) return;
    if (count <= 0) {
      router.push('/settings/invoicing');
      return;
    }
    const t = setTimeout(() => setCount((c) => (c == null ? c : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [count, router]);

  const go = () => {
    setCount(null);
    router.push('/settings/invoicing');
  };

  return (
    <Modal opened={count != null} onClose={() => setCount(null)} title="QuickBooks connected" centered withCloseButton>
      <Stack gap="sm">
        <Text size="sm">
          Your QuickBooks account is connected. We'll take you to <b>Invoicing settings</b> to review the products
          imported from QuickBooks and choose whether to apply sales tax.
        </Text>
        <Text size="sm" c="dimmed">
          Redirecting in {count ?? 0}s…
        </Text>
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={() => setCount(null)}>
            Stay here
          </Button>
          <Button onClick={go}>Go now</Button>
        </Group>
      </Stack>
    </Modal>
  );
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
      <QbConnectRedirect />
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
