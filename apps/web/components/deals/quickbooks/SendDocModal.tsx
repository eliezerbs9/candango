'use client';

import { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useSendDoc } from '@/lib/api/hooks';
import type { DealDoc } from '@/lib/api/types';

export function SendDocModal({
  dealId,
  doc,
  kind,
  opened,
  onClose,
  onSent,
}: {
  dealId: string;
  doc: DealDoc | null;
  kind: 'estimate' | 'invoice';
  opened: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const send = useSendDoc(dealId);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (opened) setEmail('');
  }, [opened]);

  if (!doc) return null;

  const submit = async () => {
    try {
      await send.mutateAsync({ kind, docId: doc.id, email: email || undefined });
      notifications.show({ message: `${kind === 'invoice' ? 'Invoice' : 'Estimate'} sent`, color: 'green' });
      onSent();
      onClose();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not send', color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Send ${kind}`} centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          QuickBooks will email this {kind} to the customer. Leave the address blank to use the customer&apos;s email
          on file.
        </Text>
        <TextInput
          label="Send to (optional)"
          placeholder="client@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={send.isPending} onClick={submit}>
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
