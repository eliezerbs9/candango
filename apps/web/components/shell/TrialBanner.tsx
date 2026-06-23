'use client';

import Link from 'next/link';
import { Button, Group, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { useOrganization } from '@/lib/api/hooks';

const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Trial countdown banner, driven by the real org: shown only while the org is
 * on the `trial` plan, counting down from creation + 7 days. (Stripe-backed
 * billing state replaces this once billing lands — see Billing & Subscriptions.)
 */
export function TrialBanner() {
  const { data: org } = useOrganization();
  if (!org || org.plan !== 'trial') return null;

  const end = new Date(org.createdAt).getTime() + TRIAL_DAYS * DAY_MS;
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / DAY_MS));

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
          {daysLeft === 0
            ? 'Your free trial has ended.'
            : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial.`}
        </Text>
      </Group>
      <Button component={Link} href="/settings/billing" size="xs" variant="filled">
        Add payment method
      </Button>
    </Group>
  );
}
