'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Anchor, Avatar, Badge, Box, Center, Divider, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useMessage, useMessageBody } from '@/lib/api/hooks';

export default function EmailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: message, isLoading } = useMessage(id);
  const { data: body, isLoading: loadingBody } = useMessageBody(id);

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
      <Anchor component={Link} href="/emails" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Back to Email
        </Group>
      </Anchor>

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
    </Stack>
  );
}
