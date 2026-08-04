'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconPencil, IconPlus, IconSignature, IconSparkles, IconTrash } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { VariableTextInput } from '@/components/common/VariableTextInput';
import { RichTextBody } from '@/components/common/RichTextBody';
import { ConnectGoogleNotice } from '@/components/email/ConnectGoogleNotice';
import {
  useCreateEmailTemplate,
  useDeleteEmailTemplate,
  useEmailTemplates,
  useGoogleStatus,
  useOrganization,
  useProfile,
  useSeedDefaultTemplates,
  useTemplateVariables,
  useUpdateEmailTemplate,
  useUpdateOrganization,
} from '@/lib/api/hooks';
import type { EmailTemplate, TemplateBodyFormat, TemplateScope, TemplateVariable } from '@/lib/api/email-templates';

const SCOPE_LABEL: Record<TemplateScope, string> = { deal: 'Deal', marketing: 'Marketing', proposal: 'Proposals', signature: 'Signatures' };
import type { Organization } from '@/lib/api/organization';
import {
  DEFAULT_SIGNATURE_HTML,
  SIGNATURE_VARIABLES,
  buildSignatureValues,
  renderPreview,
  renderPreviewText,
  renderSignatureHtml,
} from '@/lib/email-signature';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function EmailTemplatesSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: templates = [], isLoading } = useEmailTemplates();
  const { data: variables = [] } = useTemplateVariables();
  const { data: profile } = useProfile();
  const { data: org } = useOrganization();
  const { data: google, isLoading: googleLoading } = useGoogleStatus();
  const del = useDeleteEmailTemplate();
  const seed = useSeedDefaultTemplates();

  // Preview substitution: only the values we truly know (the real sender + workspace);
  // every other variable renders as its label chip, never a fake value.
  const realValues = useMemo(() => {
    const r: Record<string, string> = {};
    if (profile?.name) r['sender.name'] = profile.name;
    if (profile?.email) r['sender.email'] = profile.email;
    if (profile?.phone) r['sender.phone'] = profile.phone;
    if (org?.name) r['workspace.name'] = org.name;
    return r;
  }, [profile, org]);
  const labelByKey = useMemo(() => Object.fromEntries(variables.map((v) => [v.key, v.label])), [variables]);
  // Every tag already in use — feeds the tag picker's suggestions.
  const allTags = useMemo(
    () => [...new Set(templates.flatMap((t) => t.tags ?? []))].sort((a, b) => a.localeCompare(b)),
    [templates],
  );

  const sigValues = useMemo(
    () =>
      buildSignatureValues(
        { name: profile?.name, email: profile?.email, phone: profile?.phone, avatarUrl: profile?.avatarUrl },
        { name: org?.name, logoUrl: org?.logoUrl },
      ),
    [profile, org],
  );
  // Resolved signature (from the saved config) appended to every preview.
  const signatureHtml = useMemo(
    () => renderSignatureHtml(org?.emailSignature ?? DEFAULT_SIGNATURE_HTML, sigValues),
    [org, sigValues],
  );

  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [opened, ctl] = useDisclosure(false);
  const [sigOpened, sigCtl] = useDisclosure(false);

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

  if (isLoading || googleLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  // Email features send through the user's Gmail — unavailable without a mailbox connection.
  if (!google?.mailbox) return <ConnectGoogleNotice />;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={600}>Email templates</Text>
          <Text size="sm" c="dimmed">
            Reusable subject + body for emails you send from deals. Use{' '}
            <Text span ff="monospace">{'{{variables}}'}</Text> to auto-fill the contact&apos;s name, email, phone and
            more.
          </Text>
        </div>
        {isAdmin && (
          <Group gap="xs">
            <Button variant="default" leftSection={<IconSignature size={16} />} onClick={sigCtl.open}>
              Email signature
            </Button>
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
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {templates.map((t) => (
            <Card key={t.id} withBorder radius="md" padding="md">
              <Group justify="space-between" wrap="nowrap" align="flex-start" mb={6}>
                <div style={{ minWidth: 0 }}>
                  <Group gap={6} wrap="wrap" align="center">
                    <Text fw={600} lineClamp={1}>
                      {t.name}
                    </Text>
                    {t.scope === 'marketing' && (
                      <Badge size="xs" variant="light" color="grape" style={{ textTransform: 'none' }}>
                        Marketing
                      </Badge>
                    )}
                    {t.system && (
                      <Badge size="xs" variant="light" color="blue" style={{ textTransform: 'none' }}>
                        System
                      </Badge>
                    )}
                    {t.bodyFormat === 'html' && (
                      <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
                        HTML
                      </Badge>
                    )}
                    {(t.tags ?? []).map((tag) => (
                      <Badge key={tag} size="xs" variant="light" color="candango" style={{ textTransform: 'none' }}>
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {renderPreviewText(t.subject, realValues, labelByKey)}
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
                      {t.system ? (
                        <Menu.Item leftSection={<IconTrash size={14} />} disabled>
                          System template (can’t delete)
                        </Menu.Item>
                      ) : (
                        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(t)}>
                          Delete
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
              {/* Small rendered preview of the body + signature. */}
              <Paper
                withBorder
                radius="sm"
                p="xs"
                bg="var(--mantine-color-gray-0)"
                style={{ height: 150, overflow: 'hidden', position: 'relative' }}
              >
                <div
                  style={{ fontSize: 11, lineHeight: 1.4, pointerEvents: 'none' }}
                  dangerouslySetInnerHTML={{ __html: renderPreview(t.body, realValues, labelByKey) + signatureHtml }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 40,
                    background: 'linear-gradient(transparent, var(--mantine-color-gray-0))',
                  }}
                />
              </Paper>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {org && (
        <SignatureModal opened={sigOpened} onClose={sigCtl.close} org={org} sigValues={sigValues} isAdmin={isAdmin} />
      )}

      <TemplateModal
        opened={opened}
        onClose={ctl.close}
        editing={editing}
        variables={variables}
        realValues={realValues}
        labelByKey={labelByKey}
        signatureHtml={signatureHtml}
        allTags={allTags}
      />
    </Stack>
  );
}

/** Signature editor — same rich-text editor as the body, signature vars only, with a live preview. */
function SignatureModal({
  opened,
  onClose,
  org,
  sigValues,
  isAdmin,
}: {
  opened: boolean;
  onClose: () => void;
  org: Organization;
  sigValues: Record<string, string>;
  isAdmin: boolean;
}) {
  const update = useUpdateOrganization();
  const [html, setHtml] = useState(org.emailSignature ?? DEFAULT_SIGNATURE_HTML);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (opened) setHtml(org.emailSignature ?? DEFAULT_SIGNATURE_HTML);
  }, [opened, org.emailSignature]);

  const insertVar = (key: string) => editorRef.current?.chain().focus().insertContent(`{{${key}}}`).run();

  const save = () =>
    update.mutate(
      { emailSignature: html },
      {
        onSuccess: () => {
          notifications.show({ message: 'Signature saved', color: 'green' });
          onClose();
        },
        onError: fail,
      },
    );

  const preview = renderSignatureHtml(html, sigValues);

  return (
    <Modal opened={opened} onClose={onClose} title="Email signature" size="lg" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Added to the bottom of every email. Each sender&apos;s own photo, name, email and phone fill in
          automatically. Clear it to send with no signature.
        </Text>
        {isAdmin ? (
          <>
            <RichTextBody value={html} onChange={setHtml} onReady={(e) => (editorRef.current = e)} minHeight={140} />
            <Group gap={6} wrap="wrap">
              <Text size="xs" c="dimmed">
                Insert:
              </Text>
              {SIGNATURE_VARIABLES.map((v) => (
                <Badge
                  key={v.key}
                  variant="light"
                  color="candango"
                  style={{ cursor: 'pointer', textTransform: 'none' }}
                  onClick={() => insertVar(v.key)}
                >
                  {v.label}
                </Badge>
              ))}
            </Group>
          </>
        ) : null}
        <div>
          <Text size="xs" c="dimmed" mb={4}>
            Preview
          </Text>
          <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-0)">
            {preview ? (
              <div style={{ fontSize: 14, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <Text size="sm" c="dimmed">
                No signature.
              </Text>
            )}
          </Paper>
        </div>
        {isAdmin && (
          <Group justify="space-between">
            <Button variant="subtle" onClick={() => setHtml(DEFAULT_SIGNATURE_HTML)}>
              Reset to default
            </Button>
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} loading={update.isPending}>
                Save signature
              </Button>
            </Group>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}

function TemplateModal({
  opened,
  onClose,
  editing,
  variables,
  realValues,
  labelByKey,
  signatureHtml,
  allTags,
}: {
  opened: boolean;
  onClose: () => void;
  editing: EmailTemplate | null;
  variables: TemplateVariable[];
  realValues: Record<string, string>;
  labelByKey: Record<string, string>;
  signatureHtml: string;
  allTags: string[];
}) {
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bodyFormat, setBodyFormat] = useState<TemplateBodyFormat>('richtext');
  const [scope, setScope] = useState<TemplateScope>('deal');
  const [tags, setTags] = useState<string[]>([]);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditor = useRef<Editor | null>(null);
  const htmlBodyRef = useRef<HTMLTextAreaElement>(null);
  const active = useRef<'subject' | 'body'>('body');

  useEffect(() => {
    if (!opened) return;
    setName(editing?.name ?? '');
    setSubject(editing?.subject ?? '');
    setBody(editing?.body ?? '');
    setBodyFormat(editing?.bodyFormat ?? 'richtext');
    setScope(editing?.scope ?? 'deal');
    setTags(editing?.tags ?? []);
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
    } else if (bodyFormat === 'html') {
      const el = htmlBodyRef.current;
      const start = el?.selectionStart ?? body.length;
      const end = el?.selectionEnd ?? body.length;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el?.focus();
        const pos = start + token.length;
        el?.setSelectionRange(pos, pos);
      });
    } else {
      bodyEditor.current?.chain().focus().insertContent(token).run();
    }
  };

  // Only offer variables valid for this template's scope (a marketing template has no deal/sender vars).
  const scopedVariables = useMemo(
    () => variables.filter((v) => !v.scopes || v.scopes.includes(scope)),
    [variables, scope],
  );
  const groups = useMemo(() => {
    const map = new Map<string, TemplateVariable[]>();
    for (const v of scopedVariables) {
      const list = map.get(v.group) ?? [];
      list.push(v);
      map.set(v.group, list);
    }
    return [...map.entries()];
  }, [scopedVariables]);

  const bodyIsEmpty =
    bodyFormat === 'html'
      ? body.trim() === ''
      : body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === '';

  const submit = () => {
    if (!name.trim() || !subject.trim() || bodyIsEmpty) {
      notifications.show({ message: 'Name, subject and body are all required', color: 'red' });
      return;
    }
    const done = {
      onSuccess: () => {
        notifications.show({ message: editing ? 'Template saved' : 'Template created', color: 'green' });
        onClose();
      },
      onError: fail,
    };
    if (editing) {
      // Scope is immutable — never sent on update.
      update.mutate({ id: editing.id, body: { name: name.trim(), subject, body, bodyFormat, tags } }, done);
    } else {
      create.mutate({ name: name.trim(), subject, body, bodyFormat, tags, scope }, done);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit template' : 'New template'} size="xl" centered>
      <Grid gutter="lg">
        {/* Left: the form */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="sm">
            <TextInput
              label="Template name"
              placeholder="e.g. Estimate follow-up"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              data-autofocus
            />
            <Select
              label="Template type"
              value={scope}
              onChange={(v) => setScope((v as TemplateScope) ?? 'deal')}
              disabled={!!editing}
              allowDeselect={false}
              data={[
                { label: 'Deal', value: 'deal' },
                { label: 'Marketing', value: 'marketing' },
                { label: 'Proposals', value: 'proposal' },
                { label: 'Signatures', value: 'signature' },
              ]}
              description={
                scope === 'deal'
                  ? 'Sent from a deal — can use contact, company, deal and your (sender) details. Available in the deal send box and deal automations.'
                  : scope === 'proposal'
                    ? 'The email sent with a proposal — contact, company, deal and sender details plus the proposal link/name. One is used for every proposal.'
                    : scope === 'signature'
                      ? 'The email sent to signers with the signing link — contact, deal and sender details plus the signing link/document name. Used when a mailbox is connected.'
                      : 'Broadcast to an audience of contacts — contact, company and workspace details only (no deal or sender). Available in marketing automations.'
              }
            />
            {editing && (
              <Text size="xs" c="dimmed" mt={-6}>
                The type can’t be changed after creation.
              </Text>
            )}
            <VariableTextInput
              inputRef={subjectRef}
              label="Subject"
              required
              value={subject}
              onChange={setSubject}
              onFocus={() => (active.current = 'subject')}
              variables={scopedVariables}
            />
            <CreatableMultiSelect
              label="Tags"
              placeholder="e.g. Marketing, Onboarding"
              options={allTags.map((t) => ({ value: t, label: t }))}
              value={tags}
              onChange={setTags}
              onCreate={async (t) => ({ value: t.trim(), label: t.trim() })}
              createVerb="Add"
              emptyText="Type to add a tag"
            />
            <div>
              <Group justify="space-between" align="center" mb={4}>
                <Text size="sm" fw={500}>
                  Body
                </Text>
                <SegmentedControl
                  size="xs"
                  value={bodyFormat}
                  onChange={(v) => setBodyFormat(v as TemplateBodyFormat)}
                  data={[
                    { label: 'Rich text', value: 'richtext' },
                    { label: 'HTML', value: 'html' },
                  ]}
                />
              </Group>
              {bodyFormat === 'html' ? (
                <Textarea
                  ref={htmlBodyRef}
                  value={body}
                  onChange={(e) => setBody(e.currentTarget.value)}
                  onFocus={() => (active.current = 'body')}
                  autosize
                  minRows={10}
                  maxRows={20}
                  placeholder="Paste raw HTML here. {{variables}} still work anywhere in it."
                  styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
                />
              ) : (
                <RichTextBody value={body} onChange={setBody} onReady={onBodyReady} minHeight={200} variables={scopedVariables} />
              )}
              <Text size="xs" c="dimmed" mt={4}>
                Your signature is added automatically below the body — edit it via &ldquo;Email signature&rdquo;.
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
          </Stack>
        </Grid.Col>

        {/* Right: live preview, always visible (sticky on desktop) */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <div style={{ position: 'sticky', top: 0 }}>
            <Text size="xs" fw={600} c="dimmed" mb={4}>
              Preview
            </Text>
            <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-0)">
              <Text size="xs" c="dimmed">
                Subject
              </Text>
              <div
                style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}
                dangerouslySetInnerHTML={{ __html: renderPreview(subject, realValues, labelByKey) || '—' }}
              />
              <Divider mb="xs" />
              <div
                style={{ fontSize: 14, lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: renderPreview(body, realValues, labelByKey) + signatureHtml }}
              />
            </Paper>
          </div>
        </Grid.Col>
      </Grid>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={create.isPending || update.isPending}>
          {editing ? 'Save' : 'Create'}
        </Button>
      </Group>
    </Modal>
  );
}
