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
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import {
  useCreateEmailTemplate,
  useDeleteEmailTemplate,
  useEmailTemplates,
  useTemplateVariables,
  useUpdateEmailTemplate,
} from '@/lib/api/hooks';
import type { EmailTemplate, TemplateVariable } from '@/lib/api/email-templates';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function EmailTemplatesSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: templates = [], isLoading } = useEmailTemplates();
  const { data: variables = [] } = useTemplateVariables();
  const del = useDeleteEmailTemplate();

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
            more when you send.
          </Text>
        </div>
        {isAdmin && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New template
          </Button>
        )}
      </Group>

      {templates.length === 0 ? (
        <Text size="sm" c="dimmed">
          No templates yet. {isAdmin ? 'Create one to speed up sending estimates and invoices.' : 'Ask an admin to add one.'}
        </Text>
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
                  <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                    {t.body}
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
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Which field a variable click should insert into (the last one the user touched).
  const active = useRef<'subject' | 'body'>('body');

  useEffect(() => {
    if (!opened) return;
    setName(editing?.name ?? '');
    setSubject(editing?.subject ?? '');
    setBody(editing?.body ?? '');
    setShowPreview(false);
    active.current = 'body';
  }, [opened, editing]);

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
      const el = bodyRef.current;
      const start = el?.selectionStart ?? body.length;
      const end = el?.selectionEnd ?? body.length;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el?.focus();
        const pos = start + token.length;
        el?.setSelectionRange(pos, pos);
      });
    }
  };

  const exampleMap = useMemo(
    () => Object.fromEntries(variables.map((v) => [v.key, v.example])),
    [variables],
  );
  const preview = (text: string) =>
    text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => exampleMap[k] ?? '');

  const groups = useMemo(() => {
    const map = new Map<string, TemplateVariable[]>();
    for (const v of variables) {
      const list = map.get(v.group) ?? [];
      list.push(v);
      map.set(v.group, list);
    }
    return [...map.entries()];
  }, [variables]);

  const submit = () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
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
        <Textarea
          ref={bodyRef}
          label="Body"
          required
          autosize
          minRows={6}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          onFocus={() => (active.current = 'body')}
        />

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
          {showPreview ? 'Hide preview' : 'Show preview with example values'}
        </Button>
        {showPreview && (
          <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-0)">
            <Text size="xs" c="dimmed">
              Subject
            </Text>
            <Text size="sm" fw={500} mb="xs">
              {preview(subject) || '—'}
            </Text>
            <Divider mb="xs" />
            <Text size="xs" c="dimmed">
              Body
            </Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {preview(body) || '—'}
            </Text>
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
