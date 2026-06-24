'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Money } from '@/components/primitives/Money';
import { ApiError } from '@/lib/api/client';
import { useConvertToInvoice, useDealEstimates } from '@/lib/api/hooks';

/** Shown after a deal is marked won — offers to turn its open estimates into an invoice. */
export function WinConvertModal({
  dealId,
  currency,
  opened,
  onClose,
}: {
  dealId: string;
  currency: string;
  opened: boolean;
  onClose: () => void;
}) {
  const estimates = useDealEstimates(dealId);
  const convert = useConvertToInvoice(dealId);
  const open = (estimates.data ?? []).filter((e) => e.status !== 'closed');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (opened) setSelected(new Set(open.map((e) => e.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const chosen = open.filter((e) => selected.has(e.id));
  const total = chosen.reduce((s, e) => s + e.totalAmount, 0);

  const submit = async () => {
    if (!chosen.length) {
      onClose();
      return;
    }
    try {
      await convert.mutateAsync({ estimateIds: chosen.map((e) => e.id) });
      notifications.show({ message: 'Invoice created from estimate(s)', color: 'green' });
      onClose();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not create invoice', color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Deal won — create an invoice?" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Select the estimate(s) to combine into a QuickBooks invoice for this won deal.
        </Text>
        <Stack gap={4}>
          {open.map((e) => (
            <Checkbox
              key={e.id}
              checked={selected.has(e.id)}
              onChange={() => toggle(e.id)}
              label={
                <Group gap={6}>
                  <Text size="sm">{e.docNumber ? `#${e.docNumber}` : 'Estimate'}</Text>
                  <Text size="sm" c="dimmed">
                    <Money value={e.totalAmount} currency={e.currency} />
                  </Text>
                </Group>
              }
            />
          ))}
        </Stack>
        <Text fw={600}>
          Invoice total: <Money value={total} currency={currency} />
        </Text>
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Skip
          </Button>
          <Button loading={convert.isPending} disabled={chosen.length === 0} onClick={submit}>
            Create invoice
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
