'use client';

import Link from 'next/link';
import { Button, Group, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';

/**
 * Trial countdown banner. Days are mocked until billing state comes from the
 * API (see Billing & Subscriptions). Hidden when `daysLeft` is null.
 */
export function TrialBanner({ daysLeft = 7 }: { daysLeft?: number | null }) {
  if (daysLeft == null) return null;

  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      px="md"
      py={8}
      bg="indigo.0"
      style={{ borderBottom: '1px solid var(--mantine-color-indigo-2)' }}
    >
      <Group gap="xs" wrap="nowrap">
        <IconClock size={16} />
        <Text size="sm">
          {daysLeft} day{daysLeft === 1 ? '' : 's'} left in your free trial.
        </Text>
      </Group>
      <Button component={Link} href="/settings/billing" size="xs" variant="filled">
        Add payment method
      </Button>
    </Group>
  );
}
