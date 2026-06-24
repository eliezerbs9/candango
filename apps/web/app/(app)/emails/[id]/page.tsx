'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Anchor, Avatar, Badge, Box, Button, Center, Divider, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowBackUp, IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import { useMarkRead, useMessage, useMessageBody, useTrashMessage } from '@/lib/api/hooks';

export default function EmailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: message, isLoading } = useMessage(id);
  const { data: body, isLoading: loadingBody } = useMessageBody(id);
  const [reply, replyCtl] = useDisclosure(false);
  const markRead = useMarkRead();
  const trash = useTrashMessage();

  // Mark read on open (once), if unread.
  const markedRef = useRef(false);
  useEffect(() => {
    if (message?.unread && !markedRef.current) {
      markedRef.current = true;
      markRead.mutate(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.unread, id]);

  if (isLoading || !message) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }

  const date = new Date(message.sentAt ?? message.createdAt).toLocaleString(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const sender = message.fromAddress;

  return (
    <Stack gap="md" maw={900} mx="auto">
      <Group justify="space-between">
        <Anchor component={Link} href="/emails" size="sm">
          <Group gap={4}>
            <IconArrowLeft size={14} /> Back to Email
          </Group>
        </Anchor>
        <Group gap="xs">
          <Button size="xs" variant="light" leftSection={<IconArrowBackUp size={14} />} onClick={replyCtl.open}>
            Reply
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconTrash size={14} />}
            loading={trash.isPending}
            onClick={() =>
              trash.mutate(id, {
                onSuccess: () => {
                  notifications.show({ message: 'Moved to Trash' });
                  router.push('/emails');
                },
              })
            }
          >
            Delete
          </Button>
        </Group>
      </Group>

      <Title order={3}>{message.subject || '(no subject)'}</Title>

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group wrap="nowrap">
            <Avatar radius="xl" color="teal">
              {sender.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Text fw={600} size="sm">
                {sender}
              </Text>
              <Text size="xs" c="dimmed">
                to {message.toAddresses.join(', ') || '—'}
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Badge variant="light" color={message.direction === 'out' ? 'blue' : 'teal'}>
              {message.direction === 'out' ? 'sent' : 'received'}
            </Badge>
            {message.dealId ? (
              <Anchor component={Link} href={`/deals/${message.dealId}`} size="xs">
                Open deal
              </Anchor>
            ) : null}
          </Group>
        </Group>
        <Text size="xs" c="dimmed" mt="xs">
          {date}
        </Text>

        <Divider my="md" />

        {loadingBody ? (
          <Center mih={200}>
            <Loader size="sm" />
          </Center>
        ) : body?.html ? (
          <Box
            component="iframe"
            title="Email body"
            sandbox=""
            srcDoc={body.html}
            w="100%"
            style={{ minHeight: '70vh', border: 'none' }}
          />
        ) : (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {body?.text || message.snippet || '(no content)'}
          </Text>
        )}
      </Paper>

      <ComposeEmail
        opened={reply}
        onClose={replyCtl.close}
        defaultDealId={message.dealId ?? undefined}
        reply={{
          to: [message.fromAddress],
          subject: /^re:/i.test(message.subject ?? '') ? (message.subject ?? '') : `Re: ${message.subject ?? ''}`,
          threadId: message.threadId ?? undefined,
        }}
      />
    </Stack>
  );
}
