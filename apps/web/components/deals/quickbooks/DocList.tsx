'use client';

import { ActionIcon, Badge, Checkbox, Group, Menu, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconCurrencyDollar, IconDots } from '@tabler/icons-react';
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
  onUseAsValue,
  onOpen,
  selectedIds,
  onToggleSelect,
  emptyText,
}: {
  docs: DealDoc[];
  statuses: string[];
  onSetStatus: (id: string, status: string) => void;
  onUseAsValue?: (id: string) => void;
  onOpen?: (doc: DealDoc) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
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
        {docs.map((d) => (
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
                </Group>
                <Text size="xs" c="dimmed">
                  {new Date(d.createdAt).toLocaleDateString()} · {d.lines.length} item{d.lines.length === 1 ? '' : 's'}
                </Text>
              </UnstyledButton>
            </Table.Td>
            <Table.Td ta="right">
              <Text size="sm" fw={600}>
                <Money value={d.totalAmount} currency={d.currency} />
              </Text>
            </Table.Td>
            <Table.Td w={170} ta="right">
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
                {onUseAsValue && (
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconCurrencyDollar size={14} />} onClick={() => onUseAsValue(d.id)}>
                        Use as deal value
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
