'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconPencil, IconPlus, IconSparkles, IconTrash } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { RichTextBody } from '@/components/common/RichTextBody';
import {
  useCreateEmailTemplate,
  useDeleteEmailTemplate,
  useEmailTemplates,
  useOrganization,
  useProfile,
  useSeedDefaultTemplates,
  useTemplateVariables,
  useUpdateEmailTemplate,
} from '@/lib/api/hooks';
import type { EmailTemplate, TemplateVariable } from '@/lib/api/email-templates';
import { SIGNATURE_HTML, renderWithVars } from '@/lib/email-signature';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function EmailTemplatesSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: templates = [], isLoading } = useEmailTemplates();
  const { data: variables = [] } = useTemplateVariables();
  const del = useDeleteEmailTemplate();
  const seed = useSeedDefaultTemplates();

  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [opened, ctl] = useDisclosure(false);

  const openCreate = () => {
    setEditing(null);
    ctl.open();
  };
  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    ctl.open();
  };
  const remove = (t: EmailTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    del.mutate(t.id, {
      onSuccess: () => notifications.show({ message: 'Template deleted', color: 'green' }),
      onError: fail,
    });
  };
  const addStarters = () =>
    seed.mutate(undefined, {
      onSuccess: () => notifications.show({ message: 'Starter templates added', color: 'green' }),
      onError: fail,
    });

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={600}>Email templates</Text>
          <Text size="sm" c="dimmed">
            Reusable subject + body for emails you send from deals. Use{' '}
            <Text span ff="monospace">{'{{variables}}'}</Text> to auto-fill the contact&apos;s name, email, phone and
            more, and a <b>signature</b> (your photo, name, phone + the workspace logo) is added automatically.
          </Text>
        </div>
        {isAdmin && (
          <Group gap="xs">
            <Button variant="default" leftSection={<IconSparkles size={16} />} onClick={addStarters} loading={seed.isPending}>
              Add starter templates
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              New template
            </Button>
          </Group>
        )}
      </Group>

      {templates.length === 0 ? (
        <Card withBorder radius="md" padding="lg">
          <Stack gap="sm" align="flex-start">
            <Text size="sm" c="dimmed">
              No templates yet. {isAdmin ? 'Add the 3 starter templates (Send estimate · Send invoice · Follow-up) to get going.' : 'Ask an admin to add one.'}
            </Text>
            {isAdmin && (
              <Button leftSection={<IconSparkles size={16} />} onClick={addStarters} loading={seed.isPending}>
                Add starter templates
              </Button>
            )}
          </Stack>
        </Card>
      ) : (
        <Stack gap="sm">
          {templates.map((t) => (
            <Card key={t.id} withBorder radius="md" padding="md">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div style={{ minWidth: 0 }}>
                  <Text fw={500}>{t.name}</Text>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {t.subject}
                  </Text>
                </div>
                {isAdmin && (
                  <Menu position="bottom-end" withinPortal shadow="sm">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(t)}>
                        Edit
                      </Menu.Item>
                      <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(t)}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <TemplateModal opened={opened} onClose={ctl.close} editing={editing} variables={variables} />
    </Stack>
  );
}

function TemplateModal({
  opened,
  onClose,
  editing,
  variables,
}: {
  opened: boolean;
  onClose: () => void;
  editing: EmailTemplate | null;
  variables: TemplateVariable[];
}) {
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();
  const { data: profile } = useProfile();
  const { data: org } = useOrganization();

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditor = useRef<Editor | null>(null);
  // Which field a variable click inserts into (the last one the user touched).
  const active = useRef<'subject' | 'body'>('body');

  useEffect(() => {
    if (!opened) return;
    setName(editing?.name ?? '');
    setSubject(editing?.subject ?? '');
    setBody(editing?.body ?? '');
    setShowPreview(false);
    active.current = 'body';
  }, [opened, editing]);

  const onBodyReady = (editor: Editor | null) => {
    bodyEditor.current = editor;
    if (editor) editor.on('focus', () => (active.current = 'body'));
  };

  const insertVar = (key: string) => {
    const token = `{{${key}}}`;
    if (active.current === 'subject') {
      const el = subjectRef.current;
      const start = el?.selectionStart ?? subject.length;
      const end = el?.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + token + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el?.focus();
        const pos = start + token.length;
        el?.setSelectionRange(pos, pos);
      });
    } else {
      bodyEditor.current?.chain().focus().insertContent(token).run();
    }
  };

  // Real sender/workspace values so the preview (and its signature) look like the real thing;
  // everything else uses the catalog's example values.
  const values = useMemo(() => {
    const base: Record<string, string> = Object.fromEntries(variables.map((v) => [v.key, v.example]));
    return {
      ...base,
      'sender.name': profile?.name || base['sender.name'] || '',
      'sender.email': profile?.email || base['sender.email'] || '',
      'sender.phone': profile?.phone || base['sender.phone'] || '',
      'sender.avatar_url': profile?.avatarUrl || '',
      'workspace.name': org?.name || base['workspace.name'] || '',
      'workspace.logo_url': org?.logoUrl || '',
    };
  }, [variables, profile, org]);

  const groups = useMemo(() => {
    const map = new Map<string, TemplateVariable[]>();
    for (const v of variables) {
      if (v.hidden) continue; // image-URL vars aren't text badges
      const list = map.get(v.group) ?? [];
      list.push(v);
      map.set(v.group, list);
    }
    return [...map.entries()];
  }, [variables]);

  const bodyIsEmpty = body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === '';

  const submit = () => {
    if (!name.trim() || !subject.trim() || bodyIsEmpty) {
      notifications.show({ message: 'Name, subject and body are all required', color: 'red' });
      return;
    }
    const payload = { name: name.trim(), subject, body };
    const done = {
      onSuccess: () => {
        notifications.show({ message: editing ? 'Template saved' : 'Template created', color: 'green' });
        onClose();
      },
      onError: fail,
    };
    if (editing) update.mutate({ id: editing.id, body: payload }, done);
    else create.mutate(payload, done);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit template' : 'New template'} size="lg" centered>
      <Stack gap="sm">
        <TextInput
          label="Template name"
          placeholder="e.g. Estimate follow-up"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
        />
        <TextInput
          ref={subjectRef}
          label="Subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          onFocus={() => (active.current = 'subject')}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Body
          </Text>
          <RichTextBody value={body} onChange={setBody} onReady={onBodyReady} minHeight={200} />
          <Text size="xs" c="dimmed" mt={4}>
            A signature with your profile photo, name, email, phone and the workspace logo is added automatically —
            no need to type it here.
          </Text>
        </div>

        <div>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Insert a variable (click to add it where you were typing)
          </Text>
          <Stack gap={6}>
            {groups.map(([group, vars]) => (
              <Group key={group} gap={6} wrap="wrap">
                <Text size="xs" c="dimmed" w={72}>
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

        <Button variant="subtle" size="xs" w="fit-content" onClick={() => setShowPreview((s) => !s)}>
          {showPreview ? 'Hide preview' : 'Show preview (with signature)'}
        </Button>
        {showPreview && (
          <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-0)">
            <Text size="xs" c="dimmed">
              Subject
            </Text>
            <Text size="sm" fw={500} mb="xs">
              {renderWithVars(subject, values) || '—'}
            </Text>
            <Divider mb="xs" />
            <Text size="xs" c="dimmed" mb={4}>
              Body
            </Text>
            <div
              style={{ fontSize: 14, lineHeight: 1.5 }}
              // Admin-authored HTML shown to the same admin; variables resolved to example/real values.
              dangerouslySetInnerHTML={{ __html: renderWithVars(body, values) + renderWithVars(SIGNATURE_HTML, values) }}
            />
          </Paper>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
