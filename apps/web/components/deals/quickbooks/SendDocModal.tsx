'use client';

import { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useSendDoc } from '@/lib/api/hooks';
import type { DealDoc } from '@/lib/api/types';

export function SendDocModal({
  dealId,
  docs,
  kind,
  opened,
  onClose,
  onSent,
}: {
  dealId: string;
  docs: DealDoc[];
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

  if (!docs.length) return null;

  const submit = async () => {
    try {
      for (const d of docs) await send.mutateAsync({ kind, docId: d.id, email: email || undefined });
      notifications.show({ message: `${docs.length} ${kind}${docs.length > 1 ? 's' : ''} sent`, color: 'green' });
      onSent();
      onClose();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not send', color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Send ${docs.length > 1 ? `${docs.length} ${kind}s` : kind}`} centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          QuickBooks will email {docs.length > 1 ? `these ${docs.length} ${kind}s` : `this ${kind}`} to the customer.
          Leave the address blank to use the customer&apos;s email on file.
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
