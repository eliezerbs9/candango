'use client';

import { Badge, Group, Text } from '@mantine/core';

export type PaletteVariable = { key: string; label: string };

/**
 * A reusable row of orange (candango) click-to-insert variable chips — the same look used across
 * email templates, proposals and signatures. Pair it with any field via `onInsert`.
 */
export function VariablePalette({
  variables,
  onInsert,
  label = 'Insert:',
}: {
  variables: PaletteVariable[];
  onInsert: (key: string) => void;
  label?: string | null;
}) {
  if (variables.length === 0) return null;
  return (
    <Group gap={6} wrap="wrap" mt={6}>
      {label && (
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      )}
      {variables.map((v) => (
        <Badge
          key={v.key}
          variant="light"
          color="candango"
          style={{ cursor: 'pointer', textTransform: 'none' }}
          onClick={() => onInsert(v.key)}
        >
          {v.label}
        </Badge>
      ))}
    </Group>
  );
}
