'use client';

import { useEffect } from 'react';
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandGoogle, IconReceipt } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useConnectGoogle, useDisconnectGoogle, useGoogleStatus } from '@/lib/api/hooks';

function GoogleCard() {
  const { data: status, isLoading } = useGoogleStatus();
  const connect = useConnectGoogle();
  const disconnect = useDisconnectGoogle();
  const connected = !!status?.connected;

  // The OAuth callback redirects back here with ?google=connected|error.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('google');
    if (!result) return;
    notifications.show(
      result === 'connected'
        ? { message: 'Google connected', color: 'green' }
        : { message: 'Google connection failed — please try again', color: 'red' },
    );
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const onConnect = async () => {
    try {
      const { url } = await connect.mutateAsync();
      window.location.href = url; // hand off to Google's consent screen
    } catch (e) {
      notifications.show({
        message: e instanceof ApiError ? e.message : 'Could not start Google connection',
        color: 'red',
      });
    }
  };

  const onDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => notifications.show({ message: 'Google disconnected' }),
      onError: (e) =>
        notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
    });
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
        <Button variant="default" loading={disconnect.isPending} onClick={onDisconnect}>
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
      <Text c="dimmed" size="sm">
        Optional integrations. The app works fully without them.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <GoogleCard />
        <Card withBorder radius="md" padding="lg">
          <Group justify="space-between" mb="xs">
            <Group gap="sm">
              <IconReceipt size={20} />
              <Text fw={600}>QuickBooks</Text>
            </Group>
            <Badge color="gray" variant="light">
              Coming soon
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Map deals to QuickBooks jobs; estimates set deal value, won deals create invoices.
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
