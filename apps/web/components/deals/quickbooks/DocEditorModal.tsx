'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
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
import type { CreateDocInput, DealDoc, QbItem } from '@/lib/api/types';

interface LineRow {
  description: string;
  quantity: number | string;
  unitPrice: number | string; // dollars in the form
  itemId: string | null;
}

const blankLine = (): LineRow => ({ description: '', quantity: 1, unitPrice: 0, itemId: null });

export function DocEditorModal({
  opened,
  onClose,
  title,
  currency = 'USD',
  loading,
  items,
  initial,
  submitLabel = 'Create',
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  currency?: string;
  loading?: boolean;
  items?: QbItem[]; // QBO products/services (omit for native estimates)
  initial?: DealDoc | null; // prefill for editing
  submitLabel?: string;
  onSubmit: (input: CreateDocInput) => Promise<unknown>;
}) {
  const [txnDate, setTxnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([blankLine()]);

  // (Re)initialise whenever the modal opens.
  useEffect(() => {
    if (!opened) return;
    if (initial) {
      setTxnDate(initial.txnDate?.slice(0, 10) ?? '');
      setNotes(initial.notes ?? '');
      setLines(
        initial.lines.length
          ? initial.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice / 100,
              itemId: l.itemId,
            }))
          : [blankLine()],
      );
    } else {
      setTxnDate('');
      setNotes('');
      setLines([blankLine()]);
    }
  }, [opened, initial]);

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const cents = (l: LineRow) => Math.round(Number(l.quantity || 0) * Number(l.unitPrice || 0) * 100);
  const total = lines.reduce((sum, l) => sum + cents(l), 0);
  const itemData = (items ?? []).map((i) => ({ value: i.id, label: i.name }));

  const pickItem = (i: number, itemId: string | null) => {
    const name = items?.find((it) => it.id === itemId)?.name;
    setLine(i, { itemId, ...(name && !lines[i].description ? { description: name } : {}) });
  };

  const submit = async () => {
    const clean = lines
      .filter((l) => l.description.trim() && Number(l.quantity) > 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: Math.round(Number(l.quantity)),
        unitPrice: Math.round(Number(l.unitPrice || 0) * 100),
        ...(l.itemId ? { itemId: l.itemId } : {}),
      }));
    if (!clean.length) {
      notifications.show({ message: 'Add at least one line item with a description', color: 'red' });
      return;
    }
    try {
      await onSubmit({ txnDate: txnDate || undefined, notes: notes || undefined, lines: clean });
      onClose();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Could not save', color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl" centered>
      <Stack gap="sm">
        <TextInput type="date" label="Date" value={txnDate} onChange={(e) => setTxnDate(e.currentTarget.value)} />

        <Table verticalSpacing="xs" withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              {items && <Table.Th w={170}>Product / Service</Table.Th>}
              <Table.Th>Description</Table.Th>
              <Table.Th w={70}>Qty</Table.Th>
              <Table.Th w={120}>Unit price</Table.Th>
              <Table.Th w={100} ta="right">
                Amount
              </Table.Th>
              <Table.Th w={36} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((l, i) => (
              <Table.Tr key={i}>
                {items && (
                  <Table.Td>
                    <Select
                      placeholder="Select"
                      data={itemData}
                      value={l.itemId}
                      onChange={(v) => pickItem(i, v)}
                      searchable
                      comboboxProps={{ withinPortal: true }}
                    />
                  </Table.Td>
                )}
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
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
