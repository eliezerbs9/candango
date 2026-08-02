'use client';

import { Group, Paper, Text } from '@mantine/core';
import { Money } from '@/components/primitives/Money';
import type { ContactDeal } from '@/lib/api/contacts';

/** Headline stats for a contact/company: total deals, won deals, and total won value. */
export function ContactStats({ deals }: { deals: ContactDeal[] }) {
  const won = deals.filter((d) => d.status === 'won');
  const wonValue = won.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const currency = won[0]?.currency ?? deals[0]?.currency ?? 'USD';

  return (
    <Group gap="sm" wrap="wrap">
      <Stat label="Jobs" value={String(deals.length)} />
      <Stat label="Won" value={String(won.length)} />
      <Stat label="Won value" value={<Money value={wonValue} currency={currency} />} />
    </Group>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Paper withBorder radius="md" px="md" py="xs" style={{ minWidth: 96 }}>
      <Text size="xl" fw={700} lh={1.1}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Paper>
  );
}
