'use client';

import { useState } from 'react';
import { Badge, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/lib/auth/useAuth';

export default function GeneralSettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.orgName ?? '');

  return (
    <Stack maw={520}>
      <Text c="dimmed" size="sm">
        Your <strong>workspace</strong> (organization) — the account everything in Candango belongs
        to. Distinct from CRM <em>companies</em> you sell to.
      </Text>

      <TextInput
        label="Workspace name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />

      <Group gap="xl">
        <div>
          <Text size="xs" c="dimmed">
            Plan
          </Text>
          <Badge variant="light" color="yellow" mt={4}>
            trial
          </Badge>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Workspace ID
          </Text>
          <Text size="sm" ff="monospace" mt={4}>
            {user?.orgId ?? 'org_…'}
          </Text>
        </div>
      </Group>

      <Group>
        <Button onClick={() => notifications.show({ message: 'Workspace updated', color: 'green' })}>
          Save changes
        </Button>
      </Group>
    </Stack>
  );
}
