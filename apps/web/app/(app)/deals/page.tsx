'use client';

import { useState } from 'react';
import { Button, Drawer, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Money } from '@/components/primitives/Money';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { companyName, deals, personName, stages } from '@/lib/mock/data';
import type { Deal } from '@/lib/types';

const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? '—';

export default function DealsPage() {
  const [opened, { open, close }] = useDisclosure(false);
  const [selected, setSelected] = useState<Deal | null>(null);

  const columns: Column<Deal>[] = [
    { key: 'title', header: 'Deal', render: (d) => <Text fw={500}>{d.title}</Text> },
    { key: 'company', header: 'Company', render: (d) => companyName(d.companyId) },
    { key: 'value', header: 'Value', render: (d) => <Money value={d.value} currency={d.currency} /> },
    { key: 'stage', header: 'Stage', render: (d) => stageName(d.stageId) },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
    { key: 'owner', header: 'Owner', render: (d) => d.owner },
  ];

  const onRowClick = (d: Deal) => {
    setSelected(d);
    open();
  };

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle={`${deals.length} deals`}
        actions={<Button leftSection={<IconPlus size={16} />}>New deal</Button>}
      />

      <DataTable
        columns={columns}
        data={deals}
        onRowClick={onRowClick}
        renderCard={(d) => (
          <Stack gap={4}>
            <Group justify="space-between">
              <Text fw={500}>{d.title}</Text>
              <StatusBadge status={d.status} />
            </Group>
            <Text size="sm" c="dimmed">
              {companyName(d.companyId)} · <Money value={d.value} currency={d.currency} />
            </Text>
          </Stack>
        )}
      />

      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        title={selected?.title}
        size="md"
      >
        {selected ? (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text c="dimmed">Value</Text>
              <Text fw={600}>
                <Money value={selected.value} currency={selected.currency} />
              </Text>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">Stage</Text>
              <Text>{stageName(selected.stageId)}</Text>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">Status</Text>
              <StatusBadge status={selected.status} />
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">Company</Text>
              <Text>{companyName(selected.companyId)}</Text>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">Contact</Text>
              <Text>{personName(selected.personId)}</Text>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed">Expected close</Text>
              <Text>{selected.expectedCloseDate ?? '—'}</Text>
            </Group>
            <Text size="xs" c="dimmed" mt="md">
              (Tabs for Activities / Emails / Notes / QuickBooks arrive when wired to the API.)
            </Text>
          </Stack>
        ) : null}
      </Drawer>
    </>
  );
}
