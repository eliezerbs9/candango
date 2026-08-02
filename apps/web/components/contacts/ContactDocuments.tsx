'use client';

import Link from 'next/link';
import { Anchor, Badge, Group, Stack, Text } from '@mantine/core';
import { Money } from '@/components/primitives/Money';
import type { ContactDocument } from '@/lib/api/contacts';

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'teal',
  paid: 'teal',
  rejected: 'red',
  void: 'red',
  closed: 'gray',
};

/** Estimates + invoices across a contact's deals (shown when QuickBooks is connected). */
export function ContactDocuments({ documents }: { documents: ContactDocument[] }) {
  if (documents.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No estimates or invoices yet.
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      {documents.map((d) => (
        <Group key={`${d.kind}-${d.id}`} justify="space-between" wrap="nowrap" align="flex-start">
          <div style={{ minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Badge size="xs" variant="light" color={d.kind === 'invoice' ? 'grape' : 'cyan'} style={{ textTransform: 'none' }}>
                {d.kind === 'invoice' ? 'Invoice' : 'Estimate'}
              </Badge>
              <Text size="sm" fw={500}>
                {d.docNumber ? `#${d.docNumber}` : '—'}
              </Text>
              <Badge size="xs" variant="light" color={STATUS_COLOR[d.status] ?? 'gray'} style={{ textTransform: 'none' }}>
                {d.status}
              </Badge>
            </Group>
            {d.dealTitle && (
              <Anchor component={Link} href={`/deals/${d.dealId}`} size="xs" c="dimmed">
                {d.dealTitle}
              </Anchor>
            )}
          </div>
          <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
            <Money value={d.total} currency={d.currency} />
          </Text>
        </Group>
      ))}
    </Stack>
  );
}
