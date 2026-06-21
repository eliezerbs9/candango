'use client';

import { useState } from 'react';
import { Button, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Money } from '@/components/primitives/Money';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { NewDealModal } from '@/components/deals/NewDealModal';
import { DealDetailDrawer } from '@/components/deals/DealDetailDrawer';
import { useAllStages, useDeals } from '@/lib/api/hooks';
import type { ApiDeal } from '@/lib/api/types';

export default function DealsPage() {
  const { data: deals = [], isLoading } = useDeals();
  const { data: stages = [] } = useAllStages();
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? '—';

  const [modal, modalCtl] = useDisclosure(false);
  const [selected, setSelected] = useState<ApiDeal | null>(null);

  const columns: Column<ApiDeal>[] = [
    { key: 'title', header: 'Deal', render: (d) => <Text fw={500}>{d.title}</Text> },
    { key: 'value', header: 'Value', render: (d) => <Money value={d.value} currency={d.currency} /> },
    { key: 'stage', header: 'Stage', render: (d) => stageName(d.stageId) },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
  ];

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
        onRowClick={(d) => setSelected(d)}
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

      <DealDetailDrawer deal={selected} stageName={stageName} onClose={() => setSelected(null)} />
    </>
  );
}
