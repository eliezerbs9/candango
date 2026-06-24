'use client';

import { Badge, Button, Divider, Group, Modal, Stack, Table, Text } from '@mantine/core';
import { IconPencil, IconPrinter } from '@tabler/icons-react';
import { Money } from '@/components/primitives/Money';
import type { DealDoc } from '@/lib/api/types';

export function DocViewModal({
  doc,
  kind,
  opened,
  onClose,
  onEdit,
}: {
  doc: DealDoc | null;
  kind: 'Estimate' | 'Invoice';
  opened: boolean;
  onClose: () => void;
  onEdit?: () => void;
}) {
  if (!doc) return null;
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      title={
        <Group gap="xs">
          <Text fw={600}>
            {kind} {doc.docNumber ? `#${doc.docNumber}` : '(draft)'}
          </Text>
          <Badge variant="light">{doc.status}</Badge>
          {doc.source === 'native' && (
            <Badge variant="light" color="grape">
              local
            </Badge>
          )}
        </Group>
      }
    >
      <Stack gap="sm">
        <Group gap="xl">
          <Text size="sm" c="dimmed">
            Date: {doc.txnDate ? new Date(doc.txnDate).toLocaleDateString() : new Date(doc.createdAt).toLocaleDateString()}
          </Text>
        </Group>

        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th w={60} ta="right">
                Qty
              </Table.Th>
              <Table.Th w={110} ta="right">
                Unit price
              </Table.Th>
              <Table.Th w={110} ta="right">
                Amount
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {doc.lines.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <Text size="sm">{l.description}</Text>
                  {l.itemName && (
                    <Text size="xs" c="dimmed">
                      {l.itemName}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">{l.quantity}</Table.Td>
                <Table.Td ta="right">
                  <Money value={l.unitPrice} currency={doc.currency} />
                </Table.Td>
                <Table.Td ta="right">
                  <Money value={l.amount} currency={doc.currency} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end">
          <Text fw={700}>
            Total: <Money value={doc.totalAmount} currency={doc.currency} />
          </Text>
        </Group>

        {doc.notes && (
          <>
            <Divider />
            <div>
              <Text size="xs" c="dimmed" fw={600}>
                MEMO
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {doc.notes}
              </Text>
            </div>
          </>
        )}

        <Group justify="flex-end" mt="xs">
          <Button
            variant="default"
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.open(`/print/${kind.toLowerCase()}/${doc.dealId}/${doc.id}`, '_blank')}
          >
            Print
          </Button>
          {onEdit && (
            <Button variant="light" leftSection={<IconPencil size={16} />} onClick={onEdit}>
              Edit
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
