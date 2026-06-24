'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Drawer,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { useFolderCounts, useInbox, useMessageBody } from '@/lib/api/hooks';
import type { ApiMessage, MessageFolder } from '@/lib/api/messages';

const FOLDERS: { value: MessageFolder; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'sent', label: 'Sent' },
  { value: 'trash', label: 'Trash' },
  { value: 'spam', label: 'Spam' },
];

const when = (m: ApiMessage) =>
  new Date(m.sentAt ?? m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function ReadDrawer({ message, onClose }: { message: ApiMessage | null; onClose: () => void }) {
  const { data: body, isLoading } = useMessageBody(message?.id ?? null);
  return (
    <Drawer opened={!!message} onClose={onClose} position="right" size="lg" title={message?.subject || '(no subject)'}>
      {message ? (
        <Stack gap="sm">
          <Group gap="xs">
            <Badge variant="light" color={message.direction === 'out' ? 'blue' : 'teal'}>
              {message.direction === 'out' ? 'sent' : 'received'}
            </Badge>
            <Text size="sm" c="dimmed">
              {when(message)}
            </Text>
            {message.dealId ? (
              <Anchor component={Link} href={`/deals/${message.dealId}`} size="sm">
                Open deal
              </Anchor>
            ) : null}
          </Group>
          <Text size="sm">
            <b>From:</b> {message.fromAddress}
          </Text>
          <Text size="sm">
            <b>To:</b> {message.toAddresses.join(', ') || '—'}
          </Text>

          {isLoading ? (
            <Center mih={120}>
              <Loader size="sm" />
            </Center>
          ) : body?.html ? (
            <iframe
              title="Email body"
              sandbox=""
              srcDoc={body.html}
              style={{ width: '100%', height: '60vh', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 6 }}
            />
          ) : (
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {body?.text || message.snippet || '(no content)'}
            </Text>
          )}
        </Stack>
      ) : null}
    </Drawer>
  );
}

export default function EmailsPage() {
  const [folder, setFolder] = useState<MessageFolder>('inbox');
  const [open, setOpen] = useState<ApiMessage | null>(null);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInbox(folder);
  const { data: counts = {} } = useFolderCounts();

  const messages = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      <PageHeader title="Email" subtitle="Your synced mailbox" />

      <SegmentedControl
        mb="md"
        value={folder}
        onChange={(v) => setFolder(v as MessageFolder)}
        data={FOLDERS.map((f) => ({
          value: f.value,
          label: counts[f.value] ? `${f.label} (${counts[f.value]})` : f.label,
        }))}
      />

      {isLoading ? (
        <Center mih="40vh">
          <Loader />
        </Center>
      ) : messages.length === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Stack align="center" gap="xs">
            <IconMail size={28} stroke={1.5} />
            <Text fw={500}>No emails in {folder}</Text>
            <Text size="sm" c="dimmed">
              Synced from your connected Google account.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="xs">
          {messages.map((m) => (
            <Card
              key={m.id}
              withBorder
              radius="md"
              padding="sm"
              onClick={() => setOpen(m)}
              style={{ cursor: 'pointer' }}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div style={{ minWidth: 0 }}>
                  <Text fw={500} truncate>
                    {m.subject || '(no subject)'}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {m.direction === 'out' ? `To ${m.toAddresses.join(', ')}` : `From ${m.fromAddress}`}
                  </Text>
                  {m.snippet ? (
                    <Text size="sm" c="dimmed" lineClamp={1} mt={2}>
                      {m.snippet}
                    </Text>
                  ) : null}
                </div>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {when(m)}
                </Text>
              </Group>
            </Card>
          ))}

          {hasNextPage ? (
            <Center my="sm">
              <Button variant="default" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </Center>
          ) : null}
        </Stack>
      )}

      <ReadDrawer message={open} onClose={() => setOpen(null)} />
    </>
  );
}
