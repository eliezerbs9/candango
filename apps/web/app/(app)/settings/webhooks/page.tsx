'use client';

import { Badge, Button, Code, Group, Stack, Switch, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { DataTable, type Column } from '@/components/data/DataTable';
import { webhooks, type WebhookRow } from '@/lib/mock/admin';

const columns: Column<WebhookRow>[] = [
  { key: 'url', header: 'Endpoint', render: (w) => <Code>{w.url}</Code> },
  {
    key: 'events',
    header: 'Events',
    render: (w) => (
      <Group gap={4}>
        {w.events.map((e) => (
          <Badge key={e} variant="light" size="sm" tt="none">
            {e}
          </Badge>
        ))}
      </Group>
    ),
  },
  { key: 'active', header: 'Active', render: (w) => <Switch defaultChecked={w.active} aria-label="Active" /> },
];

export default function WebhooksPage() {
  return (
    <>
      <Group justify="space-between" mb="md">
        <Text c="dimmed" size="sm">
          Signed, retried event deliveries to your endpoints.
        </Text>
        <Button leftSection={<IconPlus size={16} />}>Add webhook</Button>
      </Group>
      <DataTable
        columns={columns}
        data={webhooks}
        renderCard={(w) => (
          <Stack gap={4}>
            <Code>{w.url}</Code>
            <Group gap={4}>
              {w.events.map((e) => (
                <Badge key={e} variant="light" size="sm" tt="none">
                  {e}
                </Badge>
              ))}
            </Group>
          </Stack>
        )}
      />
    </>
  );
}
