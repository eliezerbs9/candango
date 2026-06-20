'use client';

import { Card, Stack, Table, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

/**
 * Reusable table. Below the `sm` breakpoint it collapses to a stacked card
 * list (using `renderCard` when provided) — the mobile rule from UI-0.
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  renderCard,
}: {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  renderCard?: (row: T) => React.ReactNode;
}) {
  const isMobile = useMediaQuery('(max-width: 48em)');

  if (data.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        Nothing here yet.
      </Text>
    );
  }

  if (isMobile && renderCard) {
    return (
      <Stack gap="sm">
        {data.map((row) => (
          <Card
            key={row.id}
            withBorder
            radius="md"
            padding="md"
            onClick={() => onRowClick?.(row)}
            style={{ cursor: onRowClick ? 'pointer' : undefined }}
          >
            {renderCard(row)}
          </Card>
        ))}
      </Stack>
    );
  }

  return (
    <Table.ScrollContainer minWidth={500}>
      <Table highlightOnHover striped verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => (
              <Table.Th key={c.key}>{c.header}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((row) => (
            <Table.Tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : undefined }}
            >
              {columns.map((c) => (
                <Table.Td key={c.key}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
