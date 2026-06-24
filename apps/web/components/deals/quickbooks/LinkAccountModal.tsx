'use client';

import { useState } from 'react';
import { Alert, Button, Group, Modal, Radio, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useLinkQuickbooks, useQbLinkStatus, useSearchQbParents } from '@/lib/api/hooks';
import type { QbCustomer } from '@/lib/api/types';

export function LinkAccountModal({
  dealId,
  dealTitle,
  opened,
  onClose,
}: {
  dealId: string;
  dealTitle: string;
  opened: boolean;
  onClose: () => void;
}) {
  const link = useLinkQuickbooks(dealId);
  const search = useSearchQbParents(dealId);
  const { data: status } = useQbLinkStatus(dealId, opened);
  const [mode, setMode] = useState<'client' | 'existing'>('client');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<QbCustomer[]>([]);
  const [parentCustomerId, setParentCustomerId] = useState<string | null>(null);

  const runSearch = async () => {
    try {
      const r = await search.mutateAsync(q);
      setResults(r);
      if (!r.length) notifications.show({ message: 'No matching QuickBooks customers', color: 'yellow' });
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Search failed', color: 'red' });
    }
  };

  const submit = async () => {
    if (mode === 'existing' && !parentCustomerId) {
      notifications.show({ message: 'Pick a parent customer first', color: 'red' });
      return;
    }
    try {
      await link.mutateAsync(
        mode === 'existing' ? { parentCustomerId: parentCustomerId! } : { createParent: true },
      );
      notifications.show({ message: 'Deal linked to QuickBooks', color: 'green' });
      onClose();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not link', color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Set up QuickBooks billing" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          The deal becomes a sub-account named <b>{dealTitle}</b> in QuickBooks, billed under a parent customer.
        </Text>

        {status?.clientHasParent && (
          <Alert variant="light" color="teal" icon={<IconCircleCheck size={16} />}>
            <b>{status.clientName}</b> is already in QuickBooks — we&apos;ll just add this deal as a sub-account under it.
          </Alert>
        )}

        <Radio.Group value={mode} onChange={(v) => setMode(v as 'client' | 'existing')}>
          <Stack gap="xs">
            <Radio value="client" label="Use the deal's company / contact as the parent customer" />
            <Radio value="existing" label="Nest under an existing QuickBooks customer" />
          </Stack>
        </Radio.Group>

        {mode === 'existing' && (
          <Stack gap="xs">
            <Group align="flex-end" gap="xs">
              <TextInput
                style={{ flex: 1 }}
                label="Search QuickBooks customers"
                placeholder="Customer name"
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              />
              <Button variant="light" loading={search.isPending} onClick={runSearch}>
                Search
              </Button>
            </Group>
            <Select
              placeholder={results.length ? 'Select a parent customer' : 'Search first'}
              data={results.map((c) => ({ value: c.id, label: c.name }))}
              value={parentCustomerId}
              onChange={setParentCustomerId}
              searchable
              disabled={!results.length}
            />
          </Stack>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={link.isPending} onClick={submit}>
            Link deal
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
