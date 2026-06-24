'use client';

import Link from 'next/link';
import { Button, Group, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { useBilling } from '@/lib/api/hooks';

/**
 * Trial / billing-attention banner, driven by the real Stripe-backed subscription.
 * Hidden once the subscription is active; shows a countdown while trialing and a
 * lapsed message when the trial ended or payment is overdue. See [[Billing & Subscriptions]].
 */
export function TrialBanner() {
  const { data: b } = useBilling();
  if (!b || b.status === 'active') return null;

  const ended = b.status !== 'trialing' || b.trialDaysLeft === 0;

  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      px="md"
      py={8}
      mb="md"
      bg="candango.0"
      style={{ borderBottom: '1px solid var(--mantine-color-candango-2)' }}
    >
      <Group gap="xs" wrap="nowrap">
        <IconClock size={16} />
        <Text size="sm">
          {ended
            ? 'Your free trial has ended.'
            : `${b.trialDaysLeft} day${b.trialDaysLeft === 1 ? '' : 's'} left in your free trial.`}
        </Text>
      </Group>
      <Button component={Link} href="/settings/billing" size="xs" variant="filled">
        Add payment method
      </Button>
    </Group>
  );
}
