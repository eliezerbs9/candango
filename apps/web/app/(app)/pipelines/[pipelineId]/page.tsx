'use client';

import { useParams } from 'next/navigation';
import { Button, Center, Group, Loader, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { PipelineSwitcher } from '@/components/pipeline/PipelineSwitcher';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { NewDealModal } from '@/components/deals/NewDealModal';
import { useDeals, useMoveDeal, usePipelines, useStages } from '@/lib/api/hooks';

export default function PipelinePage() {
  const params = useParams<{ pipelineId: string }>();
  const pipelineId = params.pipelineId;

  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [], isLoading: loadingStages } = useStages(pipelineId);
  const { data: deals = [], isLoading: loadingDeals } = useDeals({ pipelineId });
  const move = useMoveDeal(pipelineId);
  const [modal, modalCtl] = useDisclosure(false);

  return (
    <>
      <PageHeader
        title="Pipelines"
        subtitle="Drag deals between stages"
        actions={
          <Group>
            {pipelines.length > 0 ? <PipelineSwitcher pipelines={pipelines} value={pipelineId} /> : null}
            <Button leftSection={<IconPlus size={16} />} onClick={modalCtl.open}>
              New deal
            </Button>
          </Group>
        }
      />
      {loadingStages || loadingDeals ? (
        <Center mih="40vh">
          <Loader />
        </Center>
      ) : stages.length === 0 ? (
        <Text c="dimmed">This pipeline has no stages yet.</Text>
      ) : (
        <KanbanBoard
          stages={stages}
          deals={deals}
          onMove={(id, stageId) => move.mutate({ id, stageId })}
        />
      )}

      <NewDealModal opened={modal} onClose={modalCtl.close} defaultPipelineId={pipelineId} />
    </>
  );
}
