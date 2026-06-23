'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Center, Group, Loader, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { PipelineSwitcher } from '@/components/pipeline/PipelineSwitcher';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { StageFormModal, type StageFormValues } from '@/components/pipeline/StageFormModal';
import { NewDealModal } from '@/components/deals/NewDealModal';
import { ApiError } from '@/lib/api/client';
import {
  useCreateStage,
  useDeals,
  useDeleteStage,
  useMoveDeal,
  usePipelines,
  useStages,
  useUpdateStage,
} from '@/lib/api/hooks';
import type { ApiStage } from '@/lib/api/types';

export default function PipelinePage() {
  const params = useParams<{ pipelineId: string }>();
  const pipelineId = params.pipelineId;

  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [], isLoading: loadingStages } = useStages(pipelineId);
  const { data: deals = [], isLoading: loadingDeals } = useDeals({ pipelineId });
  const move = useMoveDeal(pipelineId);

  const createStage = useCreateStage(pipelineId);
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();

  const [dealModal, dealCtl] = useDisclosure(false);
  const [stageModal, stageCtl] = useDisclosure(false);
  const [editingStage, setEditingStage] = useState<ApiStage | null>(null);

  const onError = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const openAddStage = () => {
    setEditingStage(null);
    stageCtl.open();
  };
  const openRenameStage = (stage: ApiStage) => {
    setEditingStage(stage);
    stageCtl.open();
  };

  const submitStage = (values: StageFormValues) => {
    if (editingStage) {
      updateStage.mutate(
        { id: editingStage.id, name: values.name, probability: values.probability },
        {
          onSuccess: () => {
            notifications.show({ message: 'Stage updated', color: 'green' });
            stageCtl.close();
          },
          onError,
        },
      );
    } else {
      createStage.mutate(
        { name: values.name, probability: values.probability, position: stages.length },
        {
          onSuccess: () => {
            notifications.show({ message: 'Stage added', color: 'green' });
            stageCtl.close();
          },
          onError,
        },
      );
    }
  };

  const deleteStageWithConfirm = (stage: ApiStage) => {
    const count = deals.filter((d) => d.stageId === stage.id).length;
    const warn = count > 0 ? ` It has ${count} deal${count === 1 ? '' : 's'}.` : '';
    if (!window.confirm(`Delete the “${stage.name}” stage?${warn} This can't be undone.`)) return;
    deleteStage.mutate(stage.id, {
      onSuccess: () => notifications.show({ message: 'Stage deleted', color: 'green' }),
      onError,
    });
  };

  // Persist an explicit ordering: write each stage whose position changed (0..n-1).
  const applyOrder = (orderedIds: string[]) => {
    orderedIds.forEach((id, i) => {
      const s = stages.find((x) => x.id === id);
      if (s && s.position !== i) updateStage.mutate({ id, position: i }, { onError });
    });
  };

  // Move-left/right menu actions: swap with neighbour, then normalise.
  const moveStage = (stage: ApiStage, dir: -1 | 1) => {
    const from = stages.findIndex((s) => s.id === stage.id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= stages.length) return;
    const ids = stages.map((s) => s.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    applyOrder(ids);
  };

  return (
    <>
      <PageHeader
        title="Pipelines"
        subtitle="Drag deals between stages"
        actions={
          <Group>
            {pipelines.length > 0 ? <PipelineSwitcher pipelines={pipelines} value={pipelineId} /> : null}
            <Button leftSection={<IconPlus size={16} />} onClick={dealCtl.open}>
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
        <Group>
          <Text c="dimmed">This pipeline has no stages yet.</Text>
          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openAddStage}>
            Add the first stage
          </Button>
        </Group>
      ) : (
        <KanbanBoard
          stages={stages}
          deals={deals}
          onMove={(id, stageId) => move.mutate({ id, stageId })}
          onReorderStages={applyOrder}
          onAddStage={openAddStage}
          stageActions={{
            onRename: openRenameStage,
            onDelete: deleteStageWithConfirm,
            onMove: moveStage,
          }}
        />
      )}

      <NewDealModal opened={dealModal} onClose={dealCtl.close} defaultPipelineId={pipelineId} />
      <StageFormModal
        opened={stageModal}
        onClose={stageCtl.close}
        onSubmit={submitStage}
        initial={editingStage ? { name: editingStage.name, probability: editingStage.probability } : null}
        loading={createStage.isPending || updateStage.isPending}
      />
    </>
  );
}
