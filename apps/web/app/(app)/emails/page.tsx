'use client';

import Link from 'next/link';
import { Anchor, Badge, Card, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { useInbox } from '@/lib/api/hooks';
import type { ApiMessage } from '@/lib/api/messages';

const when = (m: ApiMessage) => {
  const d = m.sentAt ?? m.createdAt;
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export default function EmailsPage() {
  const { data: messages = [], isLoading } = useInbox();

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <PageHeader title="Email" subtitle={`${messages.length} message${messages.length === 1 ? '' : 's'}`} />

      {messages.length === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Stack align="center" gap="xs">
            <IconMail size={28} stroke={1.5} />
            <Text fw={500}>No emails synced yet</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              Connect your Google account and your emails will be captured here automatically, matched to
              the right contact and deal.
            </Text>
            <Anchor component={Link} href="/settings/integrations" size="sm">
              Go to integrations
            </Anchor>
          </Stack>
        </Card>
      ) : (
        <Stack gap="xs">
          {messages.map((m) => (
            <Card key={m.id} withBorder radius="md" padding="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div style={{ minWidth: 0 }}>
                  <Group gap={6} wrap="nowrap">
                    <Badge size="xs" variant="light" color={m.direction === 'out' ? 'blue' : 'teal'}>
                      {m.direction === 'out' ? 'sent' : 'received'}
                    </Badge>
                    <Text fw={500} truncate>
                      {m.subject || '(no subject)'}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {m.direction === 'out' ? `To ${m.toAddresses.join(', ')}` : `From ${m.fromAddress}`}
                  </Text>
                  {m.snippet ? (
                    <Text size="sm" c="dimmed" lineClamp={1} mt={2}>
                      {m.snippet}
                    </Text>
                  ) : null}
                </div>
                <Group gap="sm" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {when(m)}
                  </Text>
                  {m.dealId ? (
                    <Anchor component={Link} href={`/deals/${m.dealId}`} size="xs">
                      Deal
                    </Anchor>
                  ) : null}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </>
  );
}
