'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, FileButton, Group, Modal, Paper, Pill, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconBulb, IconPaperclip } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { Editor } from '@tiptap/react';
import { ApiError } from '@/lib/api/client';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { RichTextBody } from '@/components/common/RichTextBody';
import { ConnectGoogleNotice } from '@/components/email/ConnectGoogleNotice';
import {
  useDealRecipients,
  useDeals,
  useEmailTemplates,
  useGoogleStatus,
  useOrganization,
  usePersons,
  useProfile,
  useRenderEmailTemplate,
  useSendMessage,
  useTemplateVariables,
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
  const { data: allTemplates = [] } = useEmailTemplates();
  // This composer sends in a deal's context; a missing/legacy scope defaults to deal, so only
  // marketing templates are excluded.
  const templates = useMemo(() => allTemplates.filter((t) => t.scope !== 'marketing'), [allTemplates]);
  const { data: profile } = useProfile();
  const { data: org } = useOrganization();
  const { data: google } = useGoogleStatus();
  const { data: allVariables = [] } = useTemplateVariables();
  // Deal composer → deal-scope variables (a missing scope defaults to deal).
  const variables = useMemo(
    () => allVariables.filter((v) => !v.hidden && (!v.scopes || v.scopes.includes('deal'))),
    [allVariables],
  );
  const send = useSendMessage();
  const renderTpl = useRenderEmailTemplate();

  // Opened from a deal (or an estimate/invoice) → the deal is fixed, so hide the selector.
  const dealHidden = lockDeal || !!defaultDealId;

  const [dealId, setDealId] = useState<string | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);

  // Variable insertion: track which field is focused + the tiptap editor, like the template editor.
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditor = useRef<Editor | null>(null);
  const activeField = useRef<'subject' | 'body'>('body');
  const onBodyReady = (editor: Editor | null) => {
    bodyEditor.current = editor;
    if (editor) editor.on('focus', () => (activeField.current = 'body'));
  };
  const insertVar = (key: string) => {
    const token = `{{${key}}}`;
    if (activeField.current === 'subject') {
      const el = subjectRef.current;
      const start = el?.selectionStart ?? subject.length;
      const end = el?.selectionEnd ?? subject.length;
      setSubject(subject.slice(0, start) + token + subject.slice(end));
      requestAnimationFrame(() => {
        el?.focus();
        const pos = start + token.length;
        el?.setSelectionRange(pos, pos);
      });
    } else {
      bodyEditor.current?.chain().focus().insertContent(token).run();
    }
  };
  const variableGroups = useMemo(() => {
    const map = new Map<string, typeof variables>();
    for (const v of variables) {
      const list = map.get(v.group) ?? [];
      list.push(v);
      map.set(v.group, list);
    }
    return [...map.entries()];
  }, [variables]);

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

  // The deal's people (primary contact → participants → company contacts), resolved server-side
  // from the deal's actual relations — reliable regardless of the global person list.
  const { data: dealRecipients = [] } = useDealRecipients(dealId);
  const recipientOptions = useMemo(
    () =>
      dealRecipients
        .filter((r) => r.email)
        .map((r) => ({ value: r.email as string, label: r.name ? `${r.name} · ${r.email}` : (r.email as string) })),
    [dealRecipients],
  );
  const recipientEmails = useMemo(() => recipientOptions.map((o) => o.value), [recipientOptions]);

  // Once the user edits "To", stop auto-prefilling it from the deal.
  const toTouched = useRef(false);

  useEffect(() => {
    if (!opened) return;
    toTouched.current = false;
    setDealId(defaultDealId ?? null);
    setTo(reply ? reply.to : []);
    setSubject(reply ? reply.subject : defaultSubject ?? '');
    setBody('');
    setTemplateId(null);
    setAttachments(initialAttachments ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // The deal's recipients load async — prefill "To" once they arrive (unless the user touched it).
  useEffect(() => {
    if (!opened || reply || toTouched.current || to.length > 0) return;
    if (recipientEmails.length > 0) setTo(recipientEmails);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientEmails]);

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
    if (!reply) {
      toTouched.current = false;
      setTo([]); // re-prefills from the new deal's recipients once they load
    }
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

  // Sending goes through the user's Gmail — no composing/sending without a mailbox connection.
  if (!google?.mailbox) {
    return (
      <Modal opened={opened} onClose={onClose} title={reply ? 'Reply' : 'New email'} size="lg">
        <ConnectGoogleNotice />
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title={reply ? 'Reply' : 'New email'} size="lg">
      <Stack>
        {/* Opened from a deal → auto-linked and hidden; otherwise selectable. */}
        {!dealHidden && (
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
          options={recipientOptions}
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
        <TextInput
          ref={subjectRef}
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          onFocus={() => (activeField.current = 'subject')}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Message
          </Text>
          <RichTextBody value={body} onChange={setBody} onReady={onBodyReady} variables={variables} />
          {variableGroups.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <Text size="xs" fw={600} c="dimmed" mb={4}>
                Insert a variable (click to add it where you were typing)
              </Text>
              <Stack gap={6}>
                {variableGroups.map(([group, vars]) => (
                  <Group key={group} gap={6} wrap="wrap">
                    <Text size="xs" c="dimmed" w={64}>
                      {group}
                    </Text>
                    {vars.map((v) => (
                      <Badge
                        key={v.key}
                        variant="light"
                        color="candango"
                        style={{ cursor: 'pointer', textTransform: 'none' }}
                        onClick={() => insertVar(v.key)}
                        title={`${v.label} — e.g. ${v.example}`}
                      >
                        {v.label}
                      </Badge>
                    ))}
                  </Group>
                ))}
              </Stack>
            </div>
          )}
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
