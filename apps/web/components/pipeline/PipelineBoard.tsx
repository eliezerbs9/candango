'use client';

import { useState } from 'react';
import { Button, Center, Group, Loader, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { KanbanBoard } from './KanbanBoard';
import { StageFormModal, type StageFormValues } from './StageFormModal';
import { ApiError } from '@/lib/api/client';
import {
  useCreateStage,
  useDeals,
  useDeleteStage,
  useMoveDeal,
  useStages,
  useUpdateStage,
} from '@/lib/api/hooks';
import type { ApiStage } from '@/lib/api/types';

/** The Kanban board for one pipeline (stages + open deals + stage management). */
export function PipelineBoard({ pipelineId }: { pipelineId: string }) {
  const { data: stages = [], isLoading: loadingStages } = useStages(pipelineId);
  // Only OPEN deals live on the board — won/lost (and archived) leave the pipeline.
  const { data: deals = [], isLoading: loadingDeals } = useDeals({ pipelineId, status: 'open' });
  const move = useMoveDeal(pipelineId);

  const createStage = useCreateStage(pipelineId);
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();

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

  if (loadingStages || loadingDeals) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      {stages.length === 0 ? (
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
