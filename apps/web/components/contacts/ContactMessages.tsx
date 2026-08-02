'use client';

import Link from 'next/link';
import { Anchor, Badge, Group, Stack, Text } from '@mantine/core';
import type { ContactMessage } from '@/lib/api/contacts';

/** Recent-messages list shared by the person + company detail views. */
export function ContactMessages({ messages }: { messages: ContactMessage[] }) {
  if (messages.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No messages yet.
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {messages.map((m) => {
        const inbound = m.direction === 'in';
        return (
          <div key={m.id}>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <Badge size="xs" variant="light" color={inbound ? 'blue' : 'teal'} style={{ textTransform: 'none' }}>
                  {inbound ? 'In' : 'Out'}
                </Badge>
                <Text size="sm" fw={500} lineClamp={1}>
                  {m.subject || '(no subject)'}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {new Date(m.at).toLocaleDateString()}
              </Text>
            </Group>
            {m.snippet && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {m.snippet}
              </Text>
            )}
            {m.dealId && (
              <Anchor component={Link} href={`/deals/${m.dealId}`} size="xs">
                View deal
              </Anchor>
            )}
          </div>
        );
      })}
    </Stack>
  );
}
