'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconPencil, IconPlus, IconSignature, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useCreateSignatureTemplate,
  useDeleteSignatureTemplate,
  useSignatureTemplates,
  useTemplateVariables,
  useUpdateSignatureTemplate,
} from '@/lib/api/hooks';
import type { InitialsRule, SignatureTemplate, SignatureTemplateBody } from '@/lib/api/signature-templates';

const INITIALS_LABELS: Record<InitialsRule, string> = {
  none: 'No initials',
  every_page: 'Initials on every page',
  specified_pages: 'Initials on specific pages',
  last_page: 'Initials on the last page',
};

const fail = (e: unknown) => notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

function summarize(t: SignatureTemplate): string {
  const parts: string[] = [];
  if (t.acceptance) parts.push('Acceptance & Signature page');
  if (t.initialsRule === 'every_page') parts.push('initials on every page');
  else if (t.initialsRule === 'last_page') parts.push('initials on the last page');
  else if (t.initialsRule === 'specified_pages') parts.push(`initials on page${t.initialsPages.length === 1 ? '' : 's'} ${t.initialsPages.join(', ') || '—'}`);
  if (t.fields.length) parts.push(`${t.fields.length} placed field${t.fields.length === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'No signing fields';
}

export default function SignatureTemplatesPage() {
  const { data: templates = [], isLoading } = useSignatureTemplates();
  const del = useDeleteSignatureTemplate();
  const [editing, setEditing] = useState<SignatureTemplate | null>(null);
  const [opened, ctl] = useDisclosure(false);

  const openNew = () => {
    setEditing(null);
    ctl.open();
  };
  const openEdit = (t: SignatureTemplate) => {
    setEditing(t);
    ctl.open();
  };
  const remove = (t: SignatureTemplate) => {
    if (!window.confirm(`Delete signature template “${t.name}”?`)) return;
    del.mutate(t.id, { onSuccess: () => notifications.show({ message: 'Deleted', color: 'green' }), onError: fail });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Text fw={600} size="lg">
            Signature templates
          </Text>
          <Text size="sm" c="dimmed">
            Reusable signing recipes — an initials rule + an optional Acceptance &amp; Signature page — applied when you request a signature on a deal.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
          New template
        </Button>
      </Group>

      {isLoading ? (
        <Loader />
      ) : templates.length === 0 ? (
        <Card withBorder radius="md" padding="lg">
          <Group>
            <ThemeIcon variant="light" color="gray" size="lg" radius="md">
              <IconInfoCircle size={18} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              No signature templates yet. Create one to reuse a signing layout across deals.
            </Text>
          </Group>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {templates.map((t) => (
            <Card key={t.id} withBorder radius="md" padding="md">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" color="candango" radius="md" size="lg">
                    <IconSignature size={18} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} lineClamp={1}>
                      {t.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {summarize(t)}
                    </Text>
                  </div>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Button size="compact-xs" variant="subtle" leftSection={<IconPencil size={13} />} onClick={() => openEdit(t)}>
                    Edit
                  </Button>
                  <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconTrash size={13} />} onClick={() => remove(t)}>
                    Delete
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <TemplateModal opened={opened} onClose={ctl.close} template={editing} />
    </Stack>
  );
}

const RULE_OPTIONS = (Object.keys(INITIALS_LABELS) as InitialsRule[]).map((v) => ({ value: v, label: INITIALS_LABELS[v] }));

function TemplateModal({ opened, onClose, template }: { opened: boolean; onClose: () => void; template: SignatureTemplate | null }) {
  const create = useCreateSignatureTemplate();
  const update = useUpdateSignatureTemplate();
  const { data: variables = [] } = useTemplateVariables();
  const dealVars = useMemo(() => variables.filter((v) => !v.hidden && (!v.scopes || v.scopes.includes('deal'))), [variables]);

  const [name, setName] = useState('');
  const [initialsRule, setInitialsRule] = useState<InitialsRule>('none');
  const [pagesText, setPagesText] = useState('');
  const [acceptance, setAcceptance] = useState(true);
  const [acceptanceText, setAcceptanceText] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Re-seed the form whenever the modal opens for a different template.
  const seededFor = useRef<string | null>(null);
  const seedKey = opened ? template?.id ?? 'new' : null;
  if (seedKey && seededFor.current !== seedKey) {
    seededFor.current = seedKey;
    setName(template?.name ?? '');
    setInitialsRule(template?.initialsRule ?? 'none');
    setPagesText((template?.initialsPages ?? []).join(', '));
    setAcceptance(template?.acceptance ?? true);
    setAcceptanceText(template?.acceptanceText ?? '');
  }
  if (!opened && seededFor.current) seededFor.current = null;

  const insertVar = (key: string) => {
    const el = textRef.current;
    const token = `{{${key}}}`;
    if (!el) {
      setAcceptanceText((t) => t + token);
      return;
    }
    const start = el.selectionStart ?? acceptanceText.length;
    const end = el.selectionEnd ?? acceptanceText.length;
    const next = acceptanceText.slice(0, start) + token + acceptanceText.slice(end);
    setAcceptanceText(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const busy = create.isPending || update.isPending;
  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    const pages =
      initialsRule === 'specified_pages'
        ? pagesText
            .split(/[,\s]+/)
            .map((s) => parseInt(s, 10))
            .filter((n) => Number.isInteger(n) && n >= 1)
        : [];
    if (!acceptance && initialsRule === 'none') {
      notifications.show({ message: 'Enable the acceptance page or an initials rule', color: 'red' });
      return;
    }
    const body: SignatureTemplateBody = {
      name: name.trim(),
      initialsRule,
      initialsPages: pages,
      acceptance,
      acceptanceText: acceptance ? acceptanceText.trim() || null : null,
    };
    const done = { onSuccess: () => { notifications.show({ message: 'Saved', color: 'green' }); onClose(); }, onError: fail };
    if (template) update.mutate({ id: template.id, body }, done);
    else create.mutate(body, done);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={template ? 'Edit signature template' : 'New signature template'} centered size="lg">
      <Stack>
        <TextInput label="Name" placeholder="e.g. Initials every page + Acceptance" required value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />

        <Select label="Initials" data={RULE_OPTIONS} value={initialsRule} onChange={(v) => setInitialsRule((v as InitialsRule) ?? 'none')} allowDeselect={false} />
        {initialsRule === 'specified_pages' && (
          <TextInput
            label="Pages"
            description="Comma-separated 1-indexed page numbers, e.g. 1, 3, 5"
            placeholder="1, 2, 3"
            value={pagesText}
            onChange={(e) => setPagesText(e.currentTarget.value)}
          />
        )}

        <Switch
          label="Acceptance & Signature page"
          description="Append a length-proof final page with signature, date and printed-name fields."
          checked={acceptance}
          onChange={(e) => setAcceptance(e.currentTarget.checked)}
        />
        {acceptance && (
          <div>
            <Textarea
              ref={textRef}
              label="Acceptance wording"
              description="Shown on the appended page. Leave empty for the default. Variables resolve against the deal."
              placeholder="By signing below, I acknowledge and accept the terms of {{deal.title}}."
              autosize
              minRows={2}
              value={acceptanceText}
              onChange={(e) => setAcceptanceText(e.currentTarget.value)}
            />
            {dealVars.length > 0 && (
              <Group gap={4} mt={6}>
                {dealVars.map((v) => (
                  <Badge key={v.key} variant="light" color="gray" style={{ cursor: 'pointer', textTransform: 'none' }} onClick={() => insertVar(v.key)}>
                    {v.label}
                  </Badge>
                ))}
              </Group>
            )}
          </div>
        )}

        <Text size="xs" c="dimmed">
          Visual field placement (drag fields onto the document) is available per-request when you send a signature.
        </Text>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {template ? 'Save' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
