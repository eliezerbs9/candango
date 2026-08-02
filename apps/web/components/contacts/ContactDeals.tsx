'use client';

import Link from 'next/link';
import { Anchor, Badge, Group, Stack, Text } from '@mantine/core';
import { Money } from '@/components/primitives/Money';
import type { ContactDeal } from '@/lib/api/contacts';

const STATUS_COLOR: Record<string, string> = { open: 'blue', won: 'teal', lost: 'red' };

/** Deals list shared by the person + company detail views. */
export function ContactDeals({ deals }: { deals: ContactDeal[] }) {
  if (deals.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No deals yet.
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      {deals.map((d) => (
        <Group key={d.id} justify="space-between" wrap="nowrap" align="flex-start">
          <div style={{ minWidth: 0 }}>
            <Anchor component={Link} href={`/deals/${d.id}`} fw={500} lineClamp={1}>
              {d.title}
            </Anchor>
            <Group gap={6}>
              {d.stageName && (
                <Text size="xs" c="dimmed">
                  {d.stageName}
                </Text>
              )}
              <Badge size="xs" variant="light" color={STATUS_COLOR[d.status] ?? 'gray'} style={{ textTransform: 'none' }}>
                {d.status}
              </Badge>
            </Group>
          </div>
          <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
            <Money value={d.value} currency={d.currency} />
          </Text>
        </Group>
      ))}
    </Stack>
  );
}
