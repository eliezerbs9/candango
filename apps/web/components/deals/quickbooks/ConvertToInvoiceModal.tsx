'use client';

import { useEffect, useState } from 'react';
import { Button, Group, List, Modal, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Money } from '@/components/primitives/Money';
import { ApiError } from '@/lib/api/client';
import { useConvertToInvoice } from '@/lib/api/hooks';
import type { DealDoc } from '@/lib/api/types';

export function ConvertToInvoiceModal({
  dealId,
  estimates,
  currency,
  opened,
  onClose,
  onConverted,
}: {
  dealId: string;
  estimates: DealDoc[]; // the selected estimates
  currency: string;
  opened: boolean;
  onClose: () => void;
  onConverted: () => void;
}) {
  const convert = useConvertToInvoice(dealId);
  const [memo, setMemo] = useState('');
  const [txnDate, setTxnDate] = useState('');
  const [status, setStatus] = useState<string>('draft');

  useEffect(() => {
    if (opened) {
      setMemo('');
      setTxnDate('');
      setStatus('draft');
    }
  }, [opened]);

  const total = estimates.reduce((s, e) => s + e.totalAmount, 0);

  const submit = async () => {
    try {
      await convert.mutateAsync({
        estimateIds: estimates.map((e) => e.id),
        memo: memo || undefined,
        txnDate: txnDate || undefined,
        status,
      });
      notifications.show({ message: 'Invoice created from estimate(s)', color: 'green' });
      onConverted();
      onClose();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not create invoice', color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Convert to invoice" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {estimates.length === 1
            ? 'This estimate will be turned into a QuickBooks invoice.'
            : `These ${estimates.length} estimates will be combined into a single QuickBooks invoice.`}
        </Text>

        <List size="sm" spacing={2}>
          {estimates.map((e) => (
            <List.Item key={e.id}>
              {e.docNumber ? `#${e.docNumber}` : 'Estimate'} — <Money value={e.totalAmount} currency={e.currency} />
            </List.Item>
          ))}
        </List>

        <Text fw={600}>
          Invoice total: <Money value={total} currency={currency} />
        </Text>

        <Group grow>
          <TextInput type="date" label="Invoice date" value={txnDate} onChange={(e) => setTxnDate(e.currentTarget.value)} />
          <Select
            label="Status"
            data={['draft', 'sent', 'paid', 'void']}
            value={status}
            onChange={(v) => setStatus(v ?? 'draft')}
            allowDeselect={false}
          />
        </Group>
        <Textarea
          label="Memo"
          description="Shown on the invoice in QuickBooks"
          autosize
          minRows={2}
          value={memo}
          onChange={(e) => setMemo(e.currentTarget.value)}
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={convert.isPending} onClick={submit}>
            Create invoice
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
