'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, FileButton, Group, Modal, Pill, Select, Stack, TagsInput, Text, TextInput } from '@mantine/core';
import { IconBulb, IconPaperclip } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { RichTextBody } from '@/components/common/RichTextBody';
import { useDeals, usePersons, useSendMessage } from '@/lib/api/hooks';
import type { EmailAttachment } from '@/lib/api/messages';

export interface ReplyContext {
  to: string[];
  subject: string;
  threadId?: string;
}

const fileToAttachment = (file: File): Promise<EmailAttachment> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64: (reader.result as string).split(',')[1] ?? '',
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function ComposeEmail({
  opened,
  onClose,
  defaultDealId,
  defaultSubject,
  initialAttachments,
  reply,
  onSent,
}: {
  opened: boolean;
  onClose: () => void;
  defaultDealId?: string;
  defaultSubject?: string;
  initialAttachments?: EmailAttachment[];
  reply?: ReplyContext;
  onSent?: () => void;
}) {
  const { data: deals = [] } = useDeals();
  const { data: persons = [] } = usePersons();
  const send = useSendMessage();

  const [dealId, setDealId] = useState<string | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);

  // The emails of a deal's people (primary person + the deal company's contacts).
  const dealEmails = (id: string | null): string[] => {
    if (!id) return [];
    const deal = deals.find((d) => d.id === id);
    if (!deal) return [];
    return persons
      .filter(
        (p) =>
          p.id === deal.primaryPersonId ||
          (deal.companyId ? p.companies.some((c) => c.id === deal.companyId) : false),
      )
      .map((p) => p.email)
      .filter((e): e is string => !!e);
  };

  useEffect(() => {
    if (!opened) return;
    setDealId(defaultDealId ?? null);
    setTo(reply ? reply.to : dealEmails(defaultDealId ?? null));
    setSubject(reply ? reply.subject : defaultSubject ?? '');
    setBody('');
    setAttachments(initialAttachments ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const onDealChange = (id: string | null) => {
    setDealId(id);
    if (!reply) setTo(dealEmails(id)); // prefill recipients from the deal's people
  };

  // Smart suggest (FR-5.8): if a typed recipient is a known contact on an open deal and no deal is
  // selected yet, offer to link that deal so the email is logged to the right place.
  const suggestion = useMemo(() => {
    if (dealId || to.length === 0) return null;
    for (const email of to) {
      const person = persons.find((p) => (p.email ?? '').toLowerCase() === email.toLowerCase());
      if (!person) continue;
      const deal = deals.find(
        (d) =>
          d.status === 'open' &&
          (d.primaryPersonId === person.id ||
            (d.companyId ? person.companies.some((c) => c.id === d.companyId) : false)),
      );
      if (deal) return { person, deal };
    }
    return null;
  }, [to, dealId, persons, deals]);

  const addFiles = async (files: File[]) => {
    try {
      const next = await Promise.all(files.map(fileToAttachment));
      setAttachments((cur) => [...cur, ...next]);
    } catch {
      notifications.show({ message: 'Could not attach file', color: 'red' });
    }
  };

  const submit = () => {
    if (to.length === 0) {
      notifications.show({ message: 'Add at least one recipient', color: 'red' });
      return;
    }
    if (!subject.trim()) {
      notifications.show({ message: 'Subject is required', color: 'red' });
      return;
    }
    send.mutate(
      {
        to,
        subject: subject.trim(),
        body,
        html: true,
        attachments,
        dealId: dealId ?? undefined,
        threadId: reply?.threadId,
      },
      {
        onSuccess: () => {
          notifications.show({ message: 'Email sent', color: 'green' });
          onSent?.();
          onClose();
        },
        onError: (e) =>
          notifications.show({ message: e instanceof ApiError ? e.message : 'Send failed', color: 'red' }),
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title={reply ? 'Reply' : 'New email'} size="lg">
      <Stack>
        <Select
          label="Deal (optional)"
          placeholder="Attach to a deal — prefills recipients"
          data={deals.map((d) => ({ value: d.id, label: d.title }))}
          value={dealId}
          onChange={onDealChange}
          searchable
          clearable
        />
        <TagsInput label="To" placeholder="Type an email and press Enter" value={to} onChange={setTo} />
        {suggestion ? (
          <Alert variant="light" color="teal" icon={<IconBulb size={16} />} py="xs">
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm">
                <b>{suggestion.person.name || suggestion.person.email}</b> is on the open deal{' '}
                <b>
                  {suggestion.deal.refNumber ? `#${suggestion.deal.refNumber} ` : ''}
                  {suggestion.deal.title}
                </b>
                .
              </Text>
              <Button size="xs" variant="light" color="teal" onClick={() => setDealId(suggestion.deal.id)}>
                Link deal
              </Button>
            </Group>
          </Alert>
        ) : null}
        <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Message
          </Text>
          <RichTextBody value={body} onChange={setBody} />
        </div>

        <Group justify="space-between" align="center">
          <FileButton multiple onChange={addFiles}>
            {(props) => (
              <Button {...props} variant="default" size="xs" leftSection={<IconPaperclip size={14} />}>
                Attach files
              </Button>
            )}
          </FileButton>
          {attachments.length > 0 && (
            <Group gap={6}>
              {attachments.map((a, i) => (
                <Pill key={i} withRemoveButton onRemove={() => setAttachments((cur) => cur.filter((_, idx) => idx !== i))}>
                  {a.filename}
                </Pill>
              ))}
            </Group>
          )}
        </Group>

        <Button onClick={submit} loading={send.isPending}>
          Send
        </Button>
      </Stack>
    </Modal>
  );
}
