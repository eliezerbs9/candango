'use client';

import { Button, Card, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBrandGoogle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useConnectGoogle } from '@/lib/api/hooks';

/**
 * Standard notice shown in place of any email feature when the user has no Gmail connection.
 * Email features send through the user's Gmail, so they need it connected first.
 */
export function ConnectGoogleNotice() {
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
    <Card withBorder radius="md" padding="xl" maw={560}>
      <Stack gap="sm">
        <ThemeIcon variant="light" color="candango" radius="xl" size="lg">
          <IconBrandGoogle size={20} />
        </ThemeIcon>
        <Title order={4}>This feature requires a connected Gmail account</Title>
        <Text size="sm">
          Email is sent through your Gmail, so connect it to send estimates &amp; invoices, use templates &amp;
          automations, and see client replies on the deal timeline.
        </Text>
        <Button
          leftSection={<IconBrandGoogle size={16} />}
          onClick={onConnect}
          loading={connect.isPending}
          w="fit-content"
        >
          Connect Gmail
        </Button>
        <Text size="xs" c="dimmed">
          You can also connect it under Settings → Integrations (each user connects their own Google).
        </Text>
      </Stack>
    </Card>
  );
}
