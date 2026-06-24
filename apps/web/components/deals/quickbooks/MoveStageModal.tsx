'use client';

import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useAllStages, useUpdateDeal } from '@/lib/api/hooks';

/** Shown after an invoice status change — offers to move the deal to another pipeline stage. */
export function MoveStageModal({
  dealId,
  pipelineId,
  currentStageId,
  opened,
  onClose,
}: {
  dealId: string;
  pipelineId: string;
  currentStageId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const { data: stages = [] } = useAllStages();
  const update = useUpdateDeal();
  const [stageId, setStageId] = useState(currentStageId);

  useEffect(() => {
    if (opened) setStageId(currentStageId);
  }, [opened, currentStageId]);

  const options = stages.filter((s) => s.pipelineId === pipelineId).map((s) => ({ value: s.id, label: s.name }));

  const move = () => {
    if (stageId === currentStageId) {
      onClose();
      return;
    }
    update.mutate(
      { id: dealId, stageId },
      {
        onSuccess: () => {
          notifications.show({ message: 'Deal moved', color: 'green' });
          onClose();
        },
        onError: (e) => notifications.show({ message: e instanceof ApiError ? e.message : 'Could not move', color: 'red' }),
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Move deal in the pipeline?" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          The invoice status changed. Would you like to move this deal to a different stage?
        </Text>
        <Select label="Stage" data={options} value={stageId} onChange={(v) => setStageId(v ?? currentStageId)} allowDeselect={false} />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Skip
          </Button>
          <Button loading={update.isPending} onClick={move}>
            Move
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
