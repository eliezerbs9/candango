'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Center, Group, Loader, SegmentedControl, Stack, Switch, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Money } from '@/components/primitives/Money';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { NewDealModal } from '@/components/deals/NewDealModal';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { PipelineSwitcher } from '@/components/pipeline/PipelineSwitcher';
import { useAllStages, useDeals, usePipelines } from '@/lib/api/hooks';
import type { ApiDeal } from '@/lib/api/types';

type View = 'pipeline' | 'list';

export default function DealsPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('pipeline');
  const [showArchived, setShowArchived] = useState(false);

  const { data: pipelines = [] } = usePipelines();
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  useEffect(() => {
    if (!pipelineId && pipelines.length) setPipelineId((pipelines.find((p) => p.isDefault) ?? pipelines[0]).id);
  }, [pipelines, pipelineId]);

  const { data: deals = [], isLoading } = useDeals({ archived: showArchived });
  const { data: stages = [] } = useAllStages();
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? '—';

  const [modal, modalCtl] = useDisclosure(false);
  const open = (d: ApiDeal) => router.push(`/deals/${d.id}`);

  const columns: Column<ApiDeal>[] = [
    { key: 'title', header: 'Deal', render: (d) => <Text fw={500}>{d.title}</Text> },
    { key: 'value', header: 'Value', render: (d) => <Money value={d.value} currency={d.currency} /> },
    { key: 'stage', header: 'Stage', render: (d) => stageName(d.stageId) },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Deals"
        actions={
          <Group gap="sm">
            <SegmentedControl
              value={view}
              onChange={(v) => setView(v as View)}
              data={[
                { label: 'Pipeline', value: 'pipeline' },
                { label: 'List', value: 'list' },
              ]}
            />
            {view === 'list' && (
              <Switch label="Archived" checked={showArchived} onChange={(e) => setShowArchived(e.currentTarget.checked)} />
            )}
            {view === 'pipeline' && pipelines.length > 0 && pipelineId && (
              <PipelineSwitcher pipelines={pipelines} value={pipelineId} onChange={setPipelineId} />
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={modalCtl.open}>
              New deal
            </Button>
          </Group>
        }
      />

      {view === 'pipeline' ? (
        pipelineId ? (
          <PipelineBoard pipelineId={pipelineId} />
        ) : (
          <Center mih="40vh">
            <Loader />
          </Center>
        )
      ) : isLoading ? (
        <Center mih="40vh">
          <Loader />
        </Center>
      ) : (
        <DataTable
          columns={columns}
          data={deals}
          onRowClick={open}
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
      )}

      <NewDealModal
        opened={modal}
        onClose={modalCtl.close}
        defaultPipelineId={view === 'pipeline' ? pipelineId ?? undefined : undefined}
      />
    </>
  );
}
