'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconKey, IconPlus } from '@tabler/icons-react';
import { DataTable, type Column } from '@/components/data/DataTable';
import { apiKeys, type ApiKeyRow } from '@/lib/mock/admin';

const columns: Column<ApiKeyRow>[] = [
  { key: 'name', header: 'Name', render: (k) => <Text fw={500}>{k.name}</Text> },
  { key: 'prefix', header: 'Key', render: (k) => <Code>{k.prefix}…</Code> },
  { key: 'lastUsed', header: 'Last used', render: (k) => k.lastUsed },
  {
    key: 'scopes',
    header: 'Scopes',
    render: (k) => (
      <Group gap={4}>
        {k.scopes.map((s) => (
          <Badge key={s} variant="outline" color="gray" tt="none" size="sm">
            {s}
          </Badge>
        ))}
      </Group>
    ),
  },
];

export default function ApiKeysPage() {
  const [opened, { open, close }] = useDisclosure(false);
  const [secret, setSecret] = useState<string | null>(null);

  const createKey = () => {
    setSecret('sk_live_' + Math.abs(hashString('candango-demo')).toString(36).padEnd(32, '0'));
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text c="dimmed" size="sm">
          Scoped credentials for programmatic access. The secret is shown once.
        </Text>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setSecret(null);
            open();
          }}
        >
          Create API key
        </Button>
      </Group>

      <DataTable
        columns={columns}
        data={apiKeys}
        renderCard={(k) => (
          <Stack gap={2}>
            <Text fw={500}>{k.name}</Text>
            <Code>{k.prefix}…</Code>
          </Stack>
        )}
      />

      <Modal opened={opened} onClose={close} title="Create API key">
        {secret ? (
          <Stack>
            <Text size="sm">
              Copy this secret now — you won't be able to see it again.
            </Text>
            <Code block>{secret}</Code>
            <CopyButton value={secret}>
              {({ copied, copy }) => (
                <Button color={copied ? 'green' : 'candango'} onClick={copy}>
                  {copied ? 'Copied' : 'Copy secret'}
                </Button>
              )}
            </CopyButton>
          </Stack>
        ) : (
          <Stack>
            <TextInput label="Name" placeholder="Billing integration" leftSection={<IconKey size={16} />} />
            <Text size="xs" c="dimmed">
              Scope selection arrives when wired to the API.
            </Text>
            <Button onClick={createKey}>Create</Button>
          </Stack>
        )}
      </Modal>
    </>
  );
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
