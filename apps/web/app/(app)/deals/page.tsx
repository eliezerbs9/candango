'use client';

import { useState } from 'react';
import { Button, Center, Drawer, Group, Loader, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Money } from '@/components/primitives/Money';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { NewDealModal } from '@/components/deals/NewDealModal';
import { useAllStages, useDeals, useLoseDeal, useWinDeal } from '@/lib/api/hooks';
import type { ApiDeal } from '@/lib/api/types';

export default function DealsPage() {
  const { data: deals = [], isLoading } = useDeals();
  const { data: stages = [] } = useAllStages();
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? '—';

  const [drawer, drawerCtl] = useDisclosure(false);
  const [modal, modalCtl] = useDisclosure(false);
  const [selected, setSelected] = useState<ApiDeal | null>(null);
  const win = useWinDeal();
  const lose = useLoseDeal();

  const columns: Column<ApiDeal>[] = [
    { key: 'title', header: 'Deal', render: (d) => <Text fw={500}>{d.title}</Text> },
    { key: 'value', header: 'Value', render: (d) => <Money value={d.value} currency={d.currency} /> },
    { key: 'stage', header: 'Stage', render: (d) => stageName(d.stageId) },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
  ];

  const markWon = () => {
    if (selected) win.mutate(selected.id, { onSuccess: drawerCtl.close });
  };
  const markLost = () => {
    if (selected) lose.mutate({ id: selected.id }, { onSuccess: drawerCtl.close });
  };

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle={`${deals.length} deal${deals.length === 1 ? '' : 's'}`}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={modalCtl.open}>
            New deal
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={deals}
        onRowClick={(d) => {
          setSelected(d);
          drawerCtl.open();
        }}
        renderCard={(d) => (
          <Stack gap={4}>
            <Group justify="space-between">
              <Text fw={500}>{d.title}</Text>
              <StatusBadge status={d.status} />
            </Group>
            <Text size="sm" c="dimmed">
              {stageName(d.stageId)} · <Money value={d.value} currency={d.currency} />
            </Text>
          </Stack>
        )}
      />

      <NewDealModal opened={modal} onClose={modalCtl.close} />

      <Drawer opened={drawer} onClose={drawerCtl.close} position="right" title={selected?.title} size="md">
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
              <Text c="dimmed">Expected close</Text>
              <Text>{selected.expectedCloseDate?.slice(0, 10) ?? '—'}</Text>
            </Group>

            {selected.status === 'open' ? (
              <Group mt="md">
                <Button color="teal" onClick={markWon} loading={win.isPending}>
                  Mark won
                </Button>
                <Button color="red" variant="light" onClick={markLost} loading={lose.isPending}>
                  Mark lost
                </Button>
              </Group>
            ) : null}

            <Text size="xs" c="dimmed" mt="md">
              Linked company/contact load once Contacts is wired to the API.
            </Text>
          </Stack>
        ) : null}
      </Drawer>
    </>
  );
}
