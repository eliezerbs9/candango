'use client';

import { useEffect } from 'react';
import { Badge, Button, Card, Code, CopyButton, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandGoogle, IconMail, IconReceipt } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useCaptureAddress,
  useConnectGoogle,
  useConnectQuickbooks,
  useDisconnectGoogle,
  useDisconnectQuickbooks,
  useGoogleStatus,
  useQuickbooksStatus,
} from '@/lib/api/hooks';

/** Shows a toast for ?google=…/?quickbooks=… set by the OAuth callback redirect, then cleans the URL. */
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
  useOAuthResultToast('quickbooks', 'QuickBooks');

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

function EmailCaptureCard() {
  const { data, isLoading } = useCaptureAddress();
  const address = data?.address ?? null;

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="xs">
        <Group gap="sm">
          <IconMail size={20} />
          <Text fw={600}>Email capture (BCC)</Text>
        </Group>
        <Badge color={data?.configured ? 'green' : 'gray'} variant="light">
          {data?.configured ? 'Active' : 'Not set up'}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        BCC or forward emails to your personal capture address and they’re logged on the matching deal
        automatically — no inbox access needed.
      </Text>
      {data?.configured && address ? (
        <Group gap="xs" wrap="nowrap">
          <Code style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {address}
          </Code>
          <CopyButton value={address}>
            {({ copied, copy }) => (
              <Button variant="light" size="xs" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </CopyButton>
        </Group>
      ) : (
        <Text size="sm" c="dimmed">
          {isLoading ? 'Loading…' : 'Email capture isn’t configured on the server yet.'}
        </Text>
      )}
      {data?.sendingAs ? (
        <Text size="xs" c="dimmed" mt="sm">
          Sending as {data.sendingAs}
        </Text>
      ) : null}
    </Card>
  );
}

export default function IntegrationsPage() {
  return (
    <Stack>
      <Text c="dimmed" size="sm">
        Optional integrations. The app works fully without them.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <GoogleCard />
        <QuickbooksCard />
        <EmailCaptureCard />
      </SimpleGrid>
    </Stack>
  );
}
