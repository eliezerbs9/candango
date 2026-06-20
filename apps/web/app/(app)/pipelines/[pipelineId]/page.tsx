import { notFound } from 'next/navigation';
import { Group } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { PipelineSwitcher } from '@/components/pipeline/PipelineSwitcher';
import { dealsByPipeline, pipelines, stagesByPipeline } from '@/lib/mock/data';

export default async function PipelinePage({ params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await params;
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  if (!pipeline) notFound();

  const stages = stagesByPipeline(pipelineId);
  const deals = dealsByPipeline(pipelineId);

  return (
    <>
      <PageHeader
        title="Pipelines"
        subtitle="Drag deals between stages"
        actions={<PipelineSwitcher pipelines={pipelines} value={pipelineId} />}
      />
      <Group />
      <KanbanBoard stages={stages} initialDeals={deals} />
    </>
  );
}
