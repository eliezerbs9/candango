'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Money } from '@/components/primitives/Money';
import { ApiError } from '@/lib/api/client';
import type { CreateDocInput } from '@/lib/api/types';

interface LineRow {
  description: string;
  quantity: number | string;
  unitPrice: number | string; // dollars in the form
}

const blankLine = (): LineRow => ({ description: '', quantity: 1, unitPrice: 0 });

export function DocEditorModal({
  opened,
  onClose,
  title,
  currency = 'USD',
  loading,
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  currency?: string;
  loading?: boolean;
  onSubmit: (input: CreateDocInput) => Promise<unknown>;
}) {
  const [txnDate, setTxnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([blankLine()]);

  const reset = () => {
    setTxnDate('');
    setNotes('');
    setLines([blankLine()]);
  };

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const cents = (l: LineRow) => Math.round(Number(l.quantity || 0) * Number(l.unitPrice || 0) * 100);
  const total = lines.reduce((sum, l) => sum + cents(l), 0);

  const submit = async () => {
    const clean = lines
      .filter((l) => l.description.trim() && Number(l.quantity) > 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: Math.round(Number(l.quantity)),
        unitPrice: Math.round(Number(l.unitPrice || 0) * 100),
      }));
    if (!clean.length) {
      notifications.show({ message: 'Add at least one line item with a description', color: 'red' });
      return;
    }
    try {
      await onSubmit({ txnDate: txnDate || undefined, notes: notes || undefined, lines: clean });
      reset();
      onClose();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not save', color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg" centered>
      <Stack gap="sm">
        <TextInput type="date" label="Date" value={txnDate} onChange={(e) => setTxnDate(e.currentTarget.value)} />

        <Table verticalSpacing="xs" withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Description</Table.Th>
              <Table.Th w={80}>Qty</Table.Th>
              <Table.Th w={130}>Unit price</Table.Th>
              <Table.Th w={110} ta="right">
                Amount
              </Table.Th>
              <Table.Th w={36} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((l, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <TextInput
                    placeholder="Item or service"
                    value={l.description}
                    onChange={(e) => setLine(i, { description: e.currentTarget.value })}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput min={1} value={l.quantity} onChange={(v) => setLine(i, { quantity: v })} hideControls />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    min={0}
                    prefix="$"
                    decimalScale={2}
                    thousandSeparator=","
                    value={l.unitPrice}
                    onChange={(v) => setLine(i, { unitPrice: v })}
                  />
                </Table.Td>
                <Table.Td ta="right">
                  <Money value={cents(l)} currency={currency} />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Group justify="space-between">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setLines((ls) => [...ls, blankLine()])}
          >
            Add line
          </Button>
          <Text fw={600}>
            Total: <Money value={total} currency={currency} />
          </Text>
        </Group>

        <Textarea
          label="Notes"
          autosize
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={submit}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
