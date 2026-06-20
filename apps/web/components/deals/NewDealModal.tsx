'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useCreateDeal, usePipelines, useStages } from '@/lib/api/hooks';

export function NewDealModal({
  opened,
  onClose,
  defaultPipelineId,
}: {
  opened: boolean;
  onClose: () => void;
  defaultPipelineId?: string;
}) {
  const { data: pipelines = [] } = usePipelines();
  const create = useCreateDeal();

  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState<number | string>('');

  const { data: stages = [] } = useStages(pipelineId ?? '');

  useEffect(() => {
    if (opened) {
      const def = defaultPipelineId ?? pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
      setPipelineId(def);
      setTitle('');
      setValue('');
    }
  }, [opened, defaultPipelineId, pipelines]);

  useEffect(() => {
    setStageId(stages[0]?.id ?? null);
  }, [stages]);

  const submit = () => {
    if (!title.trim() || !pipelineId || !stageId) {
      notifications.show({ message: 'Title, pipeline and stage are required', color: 'red' });
      return;
    }
    const cents = Math.round(Number(value || 0) * 100);
    create.mutate(
      { title: title.trim(), value: cents, pipelineId, stageId },
      {
        onSuccess: () => {
          notifications.show({ message: 'Deal created', color: 'green' });
          onClose();
        },
        onError: (e) =>
          notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New deal">
      <Stack>
        <TextInput
          label="Title"
          placeholder="Acme — 50 seats"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <NumberInput label="Value (USD)" min={0} prefix="$" thousandSeparator="," value={value} onChange={setValue} />
        <Select
          label="Pipeline"
          data={pipelines.map((p) => ({ value: p.id, label: p.name }))}
          value={pipelineId}
          onChange={setPipelineId}
          allowDeselect={false}
        />
        <Select
          label="Stage"
          data={stages.map((s) => ({ value: s.id, label: s.name }))}
          value={stageId}
          onChange={setStageId}
          allowDeselect={false}
        />
        <Button onClick={submit} loading={create.isPending}>
          Create deal
        </Button>
      </Stack>
    </Modal>
  );
}
