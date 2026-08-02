'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, FileButton, Group, Modal, Paper, Pill, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconBulb, IconPaperclip } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { RichTextBody } from '@/components/common/RichTextBody';
import {
  useDeals,
  useEmailTemplates,
  useOrganization,
  usePersons,
  useProfile,
  useRenderEmailTemplate,
  useSendMessage,
} from '@/lib/api/hooks';
import { buildSignatureValues, renderSignatureHtml } from '@/lib/email-signature';
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
  lockDeal = false,
}: {
  opened: boolean;
  onClose: () => void;
  defaultDealId?: string;
  defaultSubject?: string;
  initialAttachments?: EmailAttachment[];
  reply?: ReplyContext;
  onSent?: () => void;
  /** When sending from a deal's estimate/invoice, the deal is fixed (not selectable). */
  lockDeal?: boolean;
}) {
  const { data: deals = [] } = useDeals();
  const { data: persons = [] } = usePersons();
  const { data: templates = [] } = useEmailTemplates();
  const { data: profile } = useProfile();
  const { data: org } = useOrganization();
  const send = useSendMessage();
  const renderTpl = useRenderEmailTemplate();

  const [dealId, setDealId] = useState<string | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);

  // The workspace signature, resolved with the current sender + workspace, added to every send.
  const signatureHtml = useMemo(
    () =>
      org
        ? renderSignatureHtml(
            org.emailSignature,
            buildSignatureValues(
              { name: profile?.name, email: profile?.email, phone: profile?.phone, avatarUrl: profile?.avatarUrl },
              { name: org.name, logoUrl: org.logoUrl },
            ),
          )
        : '',
    [org, profile],
  );

  // The deal's people: its primary contact + everyone at the deal's company.
  const dealPeopleOf = (id: string | null) => {
    if (!id) return [];
    const deal = deals.find((d) => d.id === id);
    if (!deal) return [];
    return persons.filter(
      (p) =>
        p.id === deal.primaryPersonId ||
        (deal.companyId ? p.companies.some((c) => c.id === deal.companyId) : false),
    );
  };
  const dealEmails = (id: string | null): string[] =>
    dealPeopleOf(id)
      .map((p) => p.email)
      .filter((e): e is string => !!e);

  const dealPeople = useMemo(() => dealPeopleOf(dealId), [dealId, deals, persons]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the user edits "To", stop auto-prefilling it from the deal.
  const toTouched = useRef(false);

  useEffect(() => {
    if (!opened) return;
    toTouched.current = false;
    setDealId(defaultDealId ?? null);
    setTo(reply ? reply.to : dealEmails(defaultDealId ?? null));
    setSubject(reply ? reply.subject : defaultSubject ?? '');
    setBody('');
    setTemplateId(null);
    setAttachments(initialAttachments ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // Deals/persons load async — if "To" is still empty and untouched when the deal's people
  // arrive, prefill it (so the recipients aren't missed just because data loaded after open).
  useEffect(() => {
    if (!opened || reply || toTouched.current || to.length > 0) return;
    const emails = dealEmails(dealId);
    if (emails.length > 0) setTo(emails);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealPeople]);

  // Load a template, resolving its variables against the current deal.
  const applyTemplate = (id: string | null, forDealId: string | null) => {
    setTemplateId(id);
    if (!id) return;
    renderTpl.mutate(
      { id, dealId: forDealId ?? undefined },
      {
        onSuccess: ({ subject: s, body: b }) => {
          setSubject(s);
          setBody(b);
        },
        onError: (e) =>
          notifications.show({ message: e instanceof ApiError ? e.message : 'Could not load template', color: 'red' }),
      },
    );
  };

  const onDealChange = (id: string | null) => {
    setDealId(id);
    if (!reply) setTo(dealEmails(id)); // prefill recipients from the deal's people
    if (templateId) applyTemplate(templateId, id); // re-resolve the chosen template for the new deal
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
        body: body + signatureHtml, // append the workspace signature (kept out of the editor)
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
        {lockDeal ? (
          // Sent from a deal's estimate/invoice — the deal is fixed.
          <TextInput label="Deal" value={deals.find((d) => d.id === dealId)?.title ?? ''} disabled />
        ) : (
          <Select
            label="Deal (optional)"
            placeholder="Attach to a deal — prefills recipients"
            data={deals.map((d) => ({ value: d.id, label: d.title }))}
            value={dealId}
            onChange={onDealChange}
            searchable
            clearable
          />
        )}
        {/* Suggests the deal's people (primary contact + the deal company's
            contacts); you can also type any email freely. */}
        <CreatableMultiSelect
          label="To"
          placeholder="Type a name or email"
          options={dealPeople
            .filter((p) => p.email)
            .map((p) => ({ value: p.email as string, label: p.name ? `${p.name} · ${p.email}` : (p.email as string) }))}
          value={to}
          onChange={(v) => {
            toTouched.current = true;
            setTo(v);
          }}
          createVerb="Add"
          emptyText="Type an email address"
          onCreate={async (typed) => {
            const email = typed.trim();
            if (!/^\S+@\S+\.\S+$/.test(email)) {
              notifications.show({ message: 'Enter a valid email address', color: 'red' });
              return null;
            }
            return { value: email, label: email };
          }}
        />
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
        {templates.length > 0 && (
          <Select
            label="Template"
            placeholder="Start from a template (optional)"
            data={templates.map((t) => ({ value: t.id, label: t.name }))}
            value={templateId}
            onChange={(id) => applyTemplate(id, dealId)}
            disabled={renderTpl.isPending}
            clearable
            searchable
          />
        )}
        <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Message
          </Text>
          <RichTextBody value={body} onChange={setBody} />
          {signatureHtml && (
            <Paper withBorder mt={6} p="xs" radius="sm" bg="var(--mantine-color-gray-0)">
              <Text size="xs" c="dimmed" mb={2}>
                Signature (added automatically)
              </Text>
              <div style={{ fontSize: 13, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: signatureHtml }} />
            </Paper>
          )}
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
