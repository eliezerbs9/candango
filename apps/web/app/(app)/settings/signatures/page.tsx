'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconFileText, IconInfoCircle, IconPencil, IconPlus, IconSignature, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useCreateSignableDocument,
  useCreateSignatureTemplate,
  useDeleteSignableDocument,
  useDeleteSignatureTemplate,
  useDuplicateSignableDocument,
  useDuplicateSignatureTemplate,
  useSignableDocuments,
  useSignatureTemplates,
  useTemplateVariables,
  useUpdateSignatureTemplate,
  useUsers,
} from '@/lib/api/hooks';
import type { InitialsParty, InitialsRule, Party2Source, SignatureParties, SignatureTemplate, SignatureTemplateBody } from '@/lib/api/signature-templates';
import type { SignableDocumentTemplate } from '@/lib/api/signable-documents';
import { VariableTextarea } from '@/components/common/VariableTextarea';

const INITIALS_LABELS: Record<InitialsRule, string> = {
  none: 'No initials',
  every_page: 'Initials on every page',
  specified_pages: 'Initials on specific pages',
  last_page: 'Initials on the last page',
};

const fail = (e: unknown) => notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

function summarize(t: SignatureTemplate): string {
  const parts: string[] = [];
  if (t.parties === 'both') parts.push('Both parties sign');
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
  const dup = useDuplicateSignatureTemplate();
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
  const duplicate = (t: SignatureTemplate) =>
    dup.mutate(t.id, { onSuccess: () => notifications.show({ message: 'Duplicated', color: 'green' }), onError: fail });

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
                  <Button size="compact-xs" variant="subtle" leftSection={<IconCopy size={13} />} onClick={() => duplicate(t)} loading={dup.isPending}>
                    Duplicate
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

      <Divider my="lg" />
      <DocumentTemplatesSection />
    </Stack>
  );
}

// ── Document templates (generated agreements) ────────────────────────────────
const MODE_LABEL: Record<string, string> = { builder: 'Visual', upload: 'Upload', html: 'HTML' };

function DocumentTemplatesSection() {
  const router = useRouter();
  const { data: docs = [], isLoading } = useSignableDocuments();
  const del = useDeleteSignableDocument();
  const dup = useDuplicateSignableDocument();
  const [newOpen, newCtl] = useDisclosure(false);

  const openEdit = (d: SignableDocumentTemplate) => router.push(`/settings/signatures/documents/${d.id}`);
  const remove = (d: SignableDocumentTemplate) => {
    if (!window.confirm(`Delete document template “${d.name}”?`)) return;
    del.mutate(d.id, { onSuccess: () => notifications.show({ message: 'Deleted', color: 'green' }), onError: fail });
  };
  const duplicate = (d: SignableDocumentTemplate) =>
    dup.mutate(d.id, { onSuccess: () => notifications.show({ message: 'Duplicated', color: 'green' }), onError: fail });

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Text fw={600} size="lg">
            Document templates
          </Text>
          <Text size="sm" c="dimmed">
            Generated agreements filled per deal — build one visually (paper, drag &amp; drop, variables + signature fields), upload a PDF and place fields, or write raw HTML. Used by the <b>Request signature</b> automation and the deal <b>Generate document</b> button.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={newCtl.open}>
          New document
        </Button>
      </Group>

      {isLoading ? (
        <Loader />
      ) : docs.length === 0 ? (
        <Card withBorder radius="md" padding="lg">
          <Group>
            <ThemeIcon variant="light" color="gray" size="lg" radius="md">
              <IconFileText size={18} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              No document templates yet. Create one to auto-generate agreements for signature.
            </Text>
          </Group>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {docs.map((d) => (
            <Card key={d.id} withBorder radius="md" padding="md">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" color="blue" radius="md" size="lg">
                    <IconFileText size={18} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} lineClamp={1}>
                      {d.name}
                    </Text>
                    <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
                      {MODE_LABEL[d.mode] ?? d.mode}
                    </Badge>
                  </div>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Button size="compact-xs" variant="subtle" leftSection={<IconPencil size={13} />} onClick={() => openEdit(d)}>
                    Edit
                  </Button>
                  <Button size="compact-xs" variant="subtle" leftSection={<IconCopy size={13} />} onClick={() => duplicate(d)} loading={dup.isPending}>
                    Duplicate
                  </Button>
                  <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconTrash size={13} />} onClick={() => remove(d)}>
                    Delete
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <CreateDocumentModal opened={newOpen} onClose={newCtl.close} />
    </Stack>
  );
}

const BUILDER_THEME_DEFAULTS = {
  primaryColor: '#e8590c',
  accentColor: '#1a1a1a',
  fontHeading: 'Inter',
  fontBody: 'Inter',
  coverStyle: 'solid' as const,
};

function CreateDocumentModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const router = useRouter();
  const create = useCreateSignableDocument();
  const [name, setName] = useState('');
  const [paperSize, setPaperSize] = useState<'letter' | 'a4'>('letter');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const submit = () => {
    create.mutate(
      { name: name.trim() || 'Untitled document', mode: 'builder', theme: { ...BUILDER_THEME_DEFAULTS, orientation, paperSize } },
      {
        onSuccess: (d) => {
          onClose();
          router.push(`/settings/signatures/documents/${d.id}`);
        },
        onError: fail,
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New document template" centered>
      <Stack>
        <TextInput label="Name" placeholder="e.g. Service Agreement" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />

        <Group grow>
          <Select
            label="Paper size"
            data={[
              { value: 'letter', label: 'US Letter (8.5 × 11)' },
              { value: 'a4', label: 'A4 (210 × 297 mm)' },
            ]}
            value={paperSize}
            onChange={(v) => setPaperSize((v as 'letter' | 'a4') ?? 'letter')}
            allowDeselect={false}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Orientation
            </Text>
            <SegmentedControl
              fullWidth
              value={orientation}
              onChange={(v) => setOrientation(v as 'portrait' | 'landscape')}
              data={[
                { value: 'portrait', label: 'Portrait' },
                { value: 'landscape', label: 'Landscape' },
              ]}
            />
          </div>
        </Group>
        <Text size="xs" c="dimmed">
          Design it with drag &amp; drop — variables and signature fields. You can also Import a PDF inside the editor to build on top of it.
        </Text>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

const RULE_OPTIONS = (Object.keys(INITIALS_LABELS) as InitialsRule[]).map((v) => ({ value: v, label: INITIALS_LABELS[v] }));

function TemplateModal({ opened, onClose, template }: { opened: boolean; onClose: () => void; template: SignatureTemplate | null }) {
  const create = useCreateSignatureTemplate();
  const update = useUpdateSignatureTemplate();
  const { data: variables = [] } = useTemplateVariables();
  const dealVars = useMemo(() => variables.filter((v) => !v.hidden && (!v.scopes || v.scopes.includes('deal'))), [variables]);
  const { data: users = [] } = useUsers();
  const userOptions = useMemo(() => users.filter((u) => u.status === 'active').map((u) => ({ value: u.id, label: u.name || u.email })), [users]);

  const [name, setName] = useState('');
  const [initialsRule, setInitialsRule] = useState<InitialsRule>('none');
  const [pagesText, setPagesText] = useState('');
  const [acceptance, setAcceptance] = useState(true);
  const [acceptanceText, setAcceptanceText] = useState('');
  const [parties, setParties] = useState<SignatureParties>('one');
  const [party2Source, setParty2Source] = useState<Party2Source>('owner');
  const [party2UserId, setParty2UserId] = useState<string | null>(null);
  const [initialsParty, setInitialsParty] = useState<InitialsParty>('client');

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
    setParties(template?.parties ?? 'one');
    setParty2Source(template?.party2Source ?? 'owner');
    setParty2UserId(template?.party2UserId ?? null);
    setInitialsParty(template?.initialsParty ?? 'client');
  }
  if (!opened && seededFor.current) seededFor.current = null;

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
    if (parties === 'both' && party2Source === 'user' && !party2UserId) {
      notifications.show({ message: 'Pick the second signer (a workspace user)', color: 'red' });
      return;
    }
    const body: SignatureTemplateBody = {
      name: name.trim(),
      initialsRule,
      initialsPages: pages,
      acceptance,
      acceptanceText: acceptance ? acceptanceText.trim() || null : null,
      parties,
      party2Source: parties === 'both' ? party2Source : 'owner',
      party2UserId: parties === 'both' && party2Source === 'user' ? party2UserId : null,
      initialsParty: parties === 'both' ? initialsParty : 'client',
    };
    const done = { onSuccess: () => { notifications.show({ message: 'Saved', color: 'green' }); onClose(); }, onError: fail };
    if (template) update.mutate({ id: template.id, body }, done);
    else create.mutate(body, done);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={template ? 'Edit signature template' : 'New signature template'} centered size="lg">
      <Stack>
        <TextInput label="Name" placeholder="e.g. Initials every page + Acceptance" required value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />

        <Select
          label="Second signer"
          description="Who counter-signs. The client — the deal's primary contact — always signs first."
          data={[
            { value: 'none', label: 'Client signs alone' },
            { value: 'owner', label: 'Deal owner (sales rep)' },
            { value: 'user', label: 'A specific workspace user' },
          ]}
          value={parties === 'one' ? 'none' : party2Source}
          onChange={(v) => {
            if (v === 'none') setParties('one');
            else {
              setParties('both');
              setParty2Source(v as Party2Source);
            }
          }}
          allowDeselect={false}
        />
        {parties === 'both' && party2Source === 'user' && (
          <Select label="Workspace user" placeholder="Pick a user" data={userOptions} value={party2UserId} onChange={setParty2UserId} searchable nothingFoundMessage="No users" />
        )}

        <Select label="Initials" data={RULE_OPTIONS} value={initialsRule} onChange={(v) => setInitialsRule((v as InitialsRule) ?? 'none')} allowDeselect={false} />
        {parties === 'both' && initialsRule !== 'none' && (
          <Select
            label="Who initials"
            data={[
              { value: 'client', label: 'Client only' },
              { value: 'sender', label: 'Second party only' },
              { value: 'both', label: 'Both parties' },
            ]}
            value={initialsParty}
            onChange={(v) => setInitialsParty((v as InitialsParty) ?? 'client')}
            allowDeselect={false}
          />
        )}
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
          <VariableTextarea
            label="Acceptance wording"
            description="Shown on the appended page. Leave empty for the default. Variables resolve against the deal."
            placeholder="By signing below, I acknowledge and accept the terms of {{deal.title}}."
            autosize
            minRows={2}
            value={acceptanceText}
            onChange={setAcceptanceText}
            variables={dealVars}
          />
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
