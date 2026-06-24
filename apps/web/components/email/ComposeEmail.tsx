'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, Select, Stack, TagsInput, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useDeals, usePersons, useSendMessage } from '@/lib/api/hooks';

export interface ReplyContext {
  to: string[];
  subject: string;
  threadId?: string;
}

export function ComposeEmail({
  opened,
  onClose,
  defaultDealId,
  reply,
}: {
  opened: boolean;
  onClose: () => void;
  defaultDealId?: string;
  reply?: ReplyContext;
}) {
  const { data: deals = [] } = useDeals();
  const { data: persons = [] } = usePersons();
  const send = useSendMessage();

  const [dealId, setDealId] = useState<string | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

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
    setSubject(reply ? reply.subject : '');
    setBody('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const onDealChange = (id: string | null) => {
    setDealId(id);
    if (!reply) setTo(dealEmails(id)); // prefill recipients from the deal's people
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
      { to, subject: subject.trim(), body, dealId: dealId ?? undefined, threadId: reply?.threadId },
      {
        onSuccess: () => {
          notifications.show({ message: 'Email sent', color: 'green' });
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
        <TagsInput
          label="To"
          placeholder="Type an email and press Enter"
          value={to}
          onChange={setTo}
        />
        <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
        <Textarea
          label="Message"
          autosize
          minRows={6}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
        />
        <Button onClick={submit} loading={send.isPending}>
          Send
        </Button>
      </Stack>
    </Modal>
  );
}
