'use client';

import { ActionIcon, Badge, Checkbox, Group, Menu, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconCurrencyDollar, IconDots, IconPrinter, IconX } from '@tabler/icons-react';
import { Money } from '@/components/primitives/Money';
import type { DealDoc } from '@/lib/api/types';

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'teal',
  rejected: 'red',
  closed: 'dark',
  paid: 'teal',
  void: 'red',
};

export function DocList({
  docs,
  statuses,
  onSetStatus,
  onToggleInValue,
  onPrint,
  onOpen,
  selectedIds,
  onToggleSelect,
  alwaysInValue,
  emptyText,
}: {
  docs: DealDoc[];
  statuses: string[];
  onSetStatus: (id: string, status: string) => void;
  onToggleInValue?: (id: string, include: boolean) => void;
  onPrint?: (doc: DealDoc) => void;
  onOpen?: (doc: DealDoc) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  alwaysInValue?: boolean; // invoices always count toward the deal value
  emptyText: string;
}) {
  if (!docs.length) {
    return (
      <Text size="sm" c="dimmed" py="xs">
        {emptyText}
      </Text>
    );
  }

  return (
    <Table verticalSpacing="xs" highlightOnHover>
      <Table.Tbody>
        {docs.map((d) => {
          const inValue = alwaysInValue || d.includeInValue;
          return (
            <Table.Tr key={d.id}>
              {onToggleSelect && (
                <Table.Td w={36}>
                  <Checkbox
                    size="sm"
                    checked={selectedIds?.has(d.id) ?? false}
                    onChange={() => onToggleSelect(d.id)}
                    aria-label="Select estimate"
                  />
                </Table.Td>
              )}
              <Table.Td>
                <UnstyledButton onClick={() => onOpen?.(d)} style={{ cursor: onOpen ? 'pointer' : 'default' }}>
                  <Group gap={6}>
                    <Text size="sm" fw={500}>
                      {d.docNumber ? `#${d.docNumber}` : 'Draft'}
                    </Text>
                    {d.source === 'native' && (
                      <Badge size="xs" variant="light" color="grape">
                        local
                      </Badge>
                    )}
                    {inValue && (
                      <Badge size="xs" variant="light" color="green">
                        in value
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {new Date(d.createdAt).toLocaleDateString()} · {d.lines.length} item{d.lines.length === 1 ? '' : 's'}
                  </Text>
                  {d.notes && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      Memo: {d.notes}
                    </Text>
                  )}
                </UnstyledButton>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm" fw={600}>
                  <Money value={d.totalAmount} currency={d.currency} />
                </Text>
              </Table.Td>
              <Table.Td w={150} ta="right">
                <Group gap={6} justify="flex-end" wrap="nowrap">
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <UnstyledButton>
                        <Badge color={STATUS_COLOR[d.status] ?? 'gray'} variant="light" rightSection={<IconChevronDown size={12} />}>
                          {d.status}
                        </Badge>
                      </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {statuses.map((s) => (
                        <Menu.Item key={s} onClick={() => onSetStatus(d.id, s)} disabled={s === d.status}>
                          {s}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                  {(onToggleInValue || onPrint) && (
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {onToggleInValue &&
                          (d.includeInValue ? (
                            <Menu.Item leftSection={<IconX size={14} />} onClick={() => onToggleInValue(d.id, false)}>
                              Remove from deal value
                            </Menu.Item>
                          ) : (
                            <Menu.Item leftSection={<IconCurrencyDollar size={14} />} onClick={() => onToggleInValue(d.id, true)}>
                              Include in deal value
                            </Menu.Item>
                          ))}
                        {onPrint && (
                          <Menu.Item leftSection={<IconPrinter size={14} />} onClick={() => onPrint(d)}>
                            Print
                          </Menu.Item>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
