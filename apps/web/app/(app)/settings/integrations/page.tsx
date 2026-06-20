'use client';

import { useState } from 'react';
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandGoogle, IconReceipt } from '@tabler/icons-react';

function IntegrationCard({
  name,
  description,
  icon,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="xs">
        <Group gap="sm">
          {icon}
          <Text fw={600}>{name}</Text>
        </Group>
        <Badge color={connected ? 'green' : 'gray'} variant="light">
          {connected ? 'Connected' : 'Not connected'}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {description}
      </Text>
      <Button
        variant={connected ? 'default' : 'filled'}
        onClick={() => {
          setConnected((c) => !c);
          notifications.show({ message: connected ? 'Disconnected' : 'Would start OAuth flow' });
        }}
      >
        {connected ? 'Disconnect' : 'Connect'}
      </Button>
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
        <IntegrationCard
          name="Google"
          description="Sync meetings with Google Calendar and capture email per salesperson."
          icon={<IconBrandGoogle size={20} />}
        />
        <IntegrationCard
          name="QuickBooks"
          description="Map deals to QuickBooks jobs; estimates set deal value, won deals create invoices."
          icon={<IconReceipt size={20} />}
        />
      </SimpleGrid>
    </Stack>
  );
}
