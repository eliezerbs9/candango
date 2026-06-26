'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import { Badge, Box, Button, Card, Center, Group, Loader, SegmentedControl, Stack, Text } from '@mantine/core';
import { IconMail, IconMailOff, IconPencil, IconRefresh } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import { useFolderCounts, useGoogleStatus, useInbox, useSyncEmail } from '@/lib/api/hooks';
import type { ApiMessage, MessageFolder } from '@/lib/api/messages';

const FOLDERS: { value: MessageFolder; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'sent', label: 'Sent' },
  { value: 'trash', label: 'Trash' },
  { value: 'spam', label: 'Spam' },
];

const when = (m: ApiMessage) =>
  new Date(m.sentAt ?? m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function EmailsPage() {
  const router = useRouter();
  const [compose, composeCtl] = useDisclosure(false);
  const [folder, setFolder] = useState<MessageFolder>('inbox');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInbox(folder);
  const { data: counts = {} } = useFolderCounts();
  const sync = useSyncEmail();
  const { data: google, isLoading: googleLoading } = useGoogleStatus();
  const connected = !!google?.mailbox;

  // Pull new mail from Gmail when the screen opens — only if Gmail is connected.
  useEffect(() => {
    if (connected) sync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const messages = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      <PageHeader
        title="Email"
        subtitle="Your synced mailbox"
        actions={
          connected ? (
            <Group>
              <Button
                variant="default"
                leftSection={<IconRefresh size={16} />}
                loading={sync.isPending}
                onClick={() => sync.mutate()}
              >
                Sync
              </Button>
              <Button leftSection={<IconPencil size={16} />} onClick={composeCtl.open}>
                Compose
              </Button>
            </Group>
          ) : undefined
        }
      />

      {googleLoading ? (
        <Center mih="40vh">
          <Loader />
        </Center>
      ) : !connected ? (
        <Card withBorder radius="md" padding="xl">
          <Stack align="center" gap="xs">
            <IconMailOff size={28} stroke={1.5} />
            <Text fw={500}>Gmail isn&apos;t connected</Text>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              Connect your Google account to sync your inbox into Candango — emails are matched to your
              contacts and deals automatically.
            </Text>
            <Button component={Link} href="/settings/integrations" mt="sm">
              Connect Gmail
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
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
                  onClick={() => router.push(`/emails/${m.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }} align="flex-start">
                      <Box
                        w={8}
                        h={8}
                        mt={6}
                        style={{ borderRadius: '50%', flexShrink: 0 }}
                        bg={m.unread ? 'teal' : 'transparent'}
                      />
                      <div style={{ minWidth: 0 }}>
                        <Group gap={6} wrap="nowrap">
                          {m.direction === 'out' ? (
                            <Badge size="xs" variant="light" color="blue">
                              sent
                            </Badge>
                          ) : null}
                          <Text fw={m.unread ? 700 : 500} truncate>
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
                    </Group>
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
        </>
      )}

      <ComposeEmail opened={compose} onClose={composeCtl.close} />
    </>
  );
}
