'use client';

import { useParams } from 'next/navigation';
import { Center, Loader, Text } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';
import { PipelineSwitcher } from '@/components/pipeline/PipelineSwitcher';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { useDeals, useMoveDeal, usePipelines, useStages } from '@/lib/api/hooks';

export default function PipelinePage() {
  const params = useParams<{ pipelineId: string }>();
  const pipelineId = params.pipelineId;

  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [], isLoading: loadingStages } = useStages(pipelineId);
  const { data: deals = [], isLoading: loadingDeals } = useDeals({ pipelineId });
  const move = useMoveDeal(pipelineId);

  return (
    <>
      <PageHeader
        title="Pipelines"
        subtitle="Drag deals between stages"
        actions={
          pipelines.length > 0 ? <PipelineSwitcher pipelines={pipelines} value={pipelineId} /> : null
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
    </>
  );
}
