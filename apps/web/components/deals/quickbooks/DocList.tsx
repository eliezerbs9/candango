'use client';

import type { ReactNode } from 'react';
import { ActionIcon, Badge, Group, Menu, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconDots } from '@tabler/icons-react';
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

/** A single per-row action shown in the row's ⋯ menu. */
export interface DocAction {
  key: string;
  label: string;
  icon?: ReactNode;
  color?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function DocList({
  docs,
  statuses,
  onSetStatus,
  onOpen,
  isStatusLocked,
  emptyText,
  connected,
  actions,
}: {
  docs: DealDoc[];
  statuses: string[];
  onSetStatus: (id: string, status: string) => void;
  onOpen?: (doc: DealDoc) => void;
  isStatusLocked?: (doc: DealDoc) => boolean;
  emptyText: string;
  connected?: boolean; // show the source ("local") badge only when QuickBooks is connected
  /** The per-row actions for this doc (Send / Print / Convert / value / Delete). */
  actions?: (doc: DealDoc) => DocAction[];
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
          const rowActions = actions?.(d) ?? [];
          return (
            <Table.Tr key={d.id}>
              <Table.Td>
                <UnstyledButton onClick={() => onOpen?.(d)} style={{ cursor: onOpen ? 'pointer' : 'default' }}>
                  <Group gap={6}>
                    <Text size="sm" fw={500}>
                      {d.docNumber ? `#${d.docNumber}` : 'Draft'}
                    </Text>
                    {d.includeInValue && (
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
              <Table.Td w={120} ta="right">
                {isStatusLocked?.(d) ? (
                  <Badge color={STATUS_COLOR[d.status] ?? 'gray'} variant="light">
                    {d.status}
                  </Badge>
                ) : (
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
                )}
              </Table.Td>
              <Table.Td w={36}>
                {rowActions.length > 0 && (
                  <Menu position="bottom-end" withinPortal shadow="sm">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {rowActions.map((a) => (
                        <Menu.Item
                          key={a.key}
                          color={a.color}
                          leftSection={a.icon}
                          disabled={a.disabled}
                          onClick={a.onClick}
                        >
                          {a.label}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
