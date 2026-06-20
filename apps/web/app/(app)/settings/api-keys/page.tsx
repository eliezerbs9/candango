'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Code,
  CopyButton,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/lib/api/hooks';
import type { ApiKey } from '@/lib/api/apikeys';

const SCOPES = [
  'deals:read',
  'deals:write',
  'deals:delete',
  'persons:read',
  'persons:write',
  'pipelines:manage',
  'reports:read',
  'webhooks:manage',
];

export default function ApiKeysPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: keys = [], isLoading } = useApiKeys(isAdmin);
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();

  const [opened, ctl] = useDisclosure(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const openCreate = () => {
    setName('');
    setScopes([]);
    setSecret(null);
    ctl.open();
  };

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    create.mutate(
      { name: name.trim(), scopes },
      { onSuccess: (data) => setSecret(data.secret), onError: fail },
    );
  };

  const columns: Column<ApiKey>[] = [
    { key: 'name', header: 'Name', render: (k) => <Text fw={500}>{k.name}</Text> },
    { key: 'prefix', header: 'Key', render: (k) => <Code>{k.prefix}…</Code> },
    {
      key: 'scopes',
      header: 'Scopes',
      render: (k) => (
        <Group gap={4}>
          {k.scopes.length ? (
            k.scopes.map((s) => (
              <Badge key={s} variant="outline" color="gray" size="sm" tt="none">
                {s}
              </Badge>
            ))
          ) : (
            <Text size="xs" c="dimmed">
              none
            </Text>
          )}
        </Group>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (k) => (
        <ActionIcon variant="subtle" color="red" aria-label="Revoke" onClick={() => revoke.mutate(k.id, { onError: fail })}>
          <IconTrash size={16} />
        </ActionIcon>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <Text c="dimmed" size="sm">
        Only admins can manage API keys.
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
          Scoped credentials for programmatic access. The secret is shown once.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Create API key
        </Button>
      </Group>

      <DataTable
        columns={columns}
        data={keys}
        renderCard={(k) => (
          <Stack gap={2}>
            <Text fw={500}>{k.name}</Text>
            <Code>{k.prefix}…</Code>
          </Stack>
        )}
      />

      <Modal opened={opened} onClose={ctl.close} title="Create API key">
        {secret ? (
          <Stack>
            <Text size="sm">Copy this secret now — you won't be able to see it again.</Text>
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
              label="Name"
              placeholder="Billing integration"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <MultiSelect
              label="Scopes"
              placeholder="Pick scopes"
              data={SCOPES}
              value={scopes}
              onChange={setScopes}
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
