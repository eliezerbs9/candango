'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, NumberInput, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';

export interface StageFormValues {
  name: string;
  probability: number;
}

export function StageFormModal({
  opened,
  onClose,
  onSubmit,
  initial,
  loading,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: StageFormValues) => void;
  initial?: { name: string; probability: number } | null;
  loading?: boolean;
}) {
  const [name, setName] = useState('');
  const [probability, setProbability] = useState<number | string>(50);

  useEffect(() => {
    if (opened) {
      setName(initial?.name ?? '');
      setProbability(initial?.probability ?? 50);
    }
  }, [opened, initial]);

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Stage name is required', color: 'red' });
      return;
    }
    onSubmit({ name: name.trim(), probability: Number(probability) || 0 });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={initial ? 'Edit stage' : 'New stage'}>
      <Stack>
        <TextInput
          label="Name"
          placeholder="Qualified"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
        />
        <NumberInput
          label="Win probability (%)"
          min={0}
          max={100}
          value={probability}
          onChange={setProbability}
        />
        <Button onClick={submit} loading={loading}>
          {initial ? 'Save changes' : 'Add stage'}
        </Button>
      </Stack>
    </Modal>
  );
}
