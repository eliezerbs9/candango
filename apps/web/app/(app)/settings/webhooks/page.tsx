'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Code,
  CopyButton,
  Drawer,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconHistory, IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import {
  useCreateWebhook,
  useDeleteWebhook,
  usePingWebhook,
  useReplayDelivery,
  useUpdateWebhook,
  useWebhookDeliveries,
  useWebhooks,
} from '@/lib/api/hooks';
import type { Webhook } from '@/lib/api/webhooks';

const EVENTS = [
  'deal.created',
  'deal.updated',
  'deal.deleted',
  'deal.stage_changed',
  'deal.won',
  'deal.lost',
  'person.created',
  'person.updated',
  'company.created',
  'activity.created',
  'activity.completed',
];

const STATUS_COLOR: Record<string, string> = { success: 'green', failed: 'red', pending: 'yellow' };

function DeliveriesDrawer({ webhookId, onClose }: { webhookId: string | null; onClose: () => void }) {
  const { data: deliveries = [], isLoading } = useWebhookDeliveries(webhookId);
  const replay = useReplayDelivery();

  return (
    <Drawer opened={!!webhookId} onClose={onClose} position="right" title="Recent deliveries" size="md">
      {isLoading ? (
        <Center mih="30vh">
          <Loader />
        </Center>
      ) : deliveries.length === 0 ? (
        <Text c="dimmed" size="sm">
          No deliveries yet. Use “Ping” to send a test event.
        </Text>
      ) : (
        <Stack gap="xs">
          {deliveries.map((d) => (
            <Group key={d.id} justify="space-between" wrap="nowrap">
              <div>
                <Group gap="xs">
                  <Badge variant="light" color={STATUS_COLOR[d.status] ?? 'gray'}>
                    {d.status}
                  </Badge>
                  <Text size="sm" tt="none">
                    {d.payload?.type ?? '—'}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  attempt {d.attempt} · HTTP {d.responseCode ?? '—'} · {new Date(d.createdAt).toLocaleString()}
                </Text>
              </div>
              <Button
                size="xs"
                variant="default"
                loading={replay.isPending}
                onClick={() =>
                  replay.mutate(d.id, {
                    onSuccess: () => notifications.show({ message: 'Replay queued', color: 'green' }),
                    onError: () => notifications.show({ message: 'Replay failed', color: 'red' }),
                  })
                }
              >
                Replay
              </Button>
            </Group>
          ))}
        </Stack>
      )}
    </Drawer>
  );
}

export default function WebhooksPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: webhooks = [], isLoading } = useWebhooks(isAdmin);
  const create = useCreateWebhook();
  const update = useUpdateWebhook();
  const del = useDeleteWebhook();
  const ping = usePingWebhook();

  const [opened, ctl] = useDisclosure(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const openCreate = () => {
    setUrl('');
    setEvents([]);
    setSecret(null);
    ctl.open();
  };

  const submit = () => {
    if (!url.trim() || events.length === 0) {
      notifications.show({ message: 'URL and at least one event are required', color: 'red' });
      return;
    }
    create.mutate(
      { url: url.trim(), eventTypes: events },
      { onSuccess: (data) => setSecret(data.secret), onError: fail },
    );
  };

  const columns: Column<Webhook>[] = [
    { key: 'url', header: 'Endpoint', render: (w) => <Code>{w.url}</Code> },
    {
      key: 'events',
      header: 'Events',
      render: (w) => (
        <Group gap={4}>
          {w.eventTypes.map((e) => (
            <Badge key={e} variant="light" size="sm" tt="none">
              {e}
            </Badge>
          ))}
        </Group>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      render: (w) => (
        <Switch
          checked={w.isActive}
          onChange={(e) => update.mutate({ id: w.id, isActive: e.currentTarget.checked }, { onError: fail })}
          aria-label="Active"
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (w) => (
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Send test event">
            <ActionIcon
              variant="subtle"
              aria-label="Ping"
              onClick={() =>
                ping.mutate(w.id, {
                  onSuccess: () => notifications.show({ message: 'Test event sent', color: 'green' }),
                  onError: fail,
                })
              }
            >
              <IconSend size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Deliveries">
            <ActionIcon variant="subtle" aria-label="Deliveries" onClick={() => setDeliveriesFor(w.id)}>
              <IconHistory size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon variant="subtle" color="red" aria-label="Delete" onClick={() => del.mutate(w.id, { onError: fail })}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <Text c="dimmed" size="sm">
        Only admins can manage webhooks.
      </Text>
    );
  }

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text c="dimmed" size="sm">
          Signed event deliveries to your endpoints.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add webhook
        </Button>
      </Group>

      <DataTable
        columns={columns}
        data={webhooks}
        renderCard={(w) => (
          <Stack gap={4}>
            <Code>{w.url}</Code>
            <Group gap={4}>
              {w.eventTypes.map((e) => (
                <Badge key={e} variant="light" size="sm" tt="none">
                  {e}
                </Badge>
              ))}
            </Group>
          </Stack>
        )}
      />

      <DeliveriesDrawer webhookId={deliveriesFor} onClose={() => setDeliveriesFor(null)} />

      <Modal opened={opened} onClose={ctl.close} title="Add webhook">
        {secret ? (
          <Stack>
            <Text size="sm">
              Save this signing secret now — you won't see it again. Use it to verify the{' '}
              <Code>X-Candango-Signature</Code> header.
            </Text>
            <Code block>{secret}</Code>
            <Group>
              <CopyButton value={secret}>
                {({ copied, copy }) => (
                  <Button color={copied ? 'green' : 'candango'} onClick={copy}>
                    {copied ? 'Copied' : 'Copy secret'}
                  </Button>
                )}
              </CopyButton>
              <Button variant="default" onClick={ctl.close}>
                Done
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack>
            <TextInput
              label="Endpoint URL"
              placeholder="https://hooks.yourapp.com/candango"
              required
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
            />
            <MultiSelect
              label="Events"
              placeholder="Pick events"
              data={EVENTS}
              value={events}
              onChange={setEvents}
              searchable
              clearable
            />
            <Button onClick={submit} loading={create.isPending}>
              Create
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  );
}
