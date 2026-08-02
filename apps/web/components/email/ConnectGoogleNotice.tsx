'use client';

import { Button, Card, List, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBrandGoogle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useConnectGoogle } from '@/lib/api/hooks';

/**
 * Shown in place of an email feature when the workspace user has no Google connection.
 * Email features send through the user's Gmail, so they're unavailable until it's connected.
 */
export function ConnectGoogleNotice({ feature }: { feature: string }) {
  const connect = useConnectGoogle();
  const onConnect = async () => {
    try {
      const { url } = await connect.mutateAsync();
      window.location.href = url;
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not start Google connect', color: 'red' });
    }
  };

  return (
    <Card withBorder radius="md" padding="xl" maw={620}>
      <Stack gap="sm">
        <ThemeIcon variant="light" color="candango" radius="xl" size="lg">
          <IconBrandGoogle size={20} />
        </ThemeIcon>
        <Title order={4}>Connect Google to use {feature}</Title>
        <Text size="sm">
          {feature} works through your Google account, so it&apos;s unavailable until you connect Gmail. Once connected
          you can:
        </Text>
        <List size="sm" spacing={4}>
          <List.Item>Send estimates &amp; invoices by email, with templates &amp; your signature</List.Item>
          <List.Item>Run email automations</List.Item>
          <List.Item>See client replies logged on the deal timeline</List.Item>
        </List>
        <Button
          leftSection={<IconBrandGoogle size={16} />}
          onClick={onConnect}
          loading={connect.isPending}
          w="fit-content"
        >
          Connect Google
        </Button>
        <Text size="xs" c="dimmed">
          You can also manage integrations under Settings → Integrations (each user connects their own Google).
        </Text>
      </Stack>
    </Card>
  );
}
