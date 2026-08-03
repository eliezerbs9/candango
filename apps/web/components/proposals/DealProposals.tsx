'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy, IconDots, IconLink, IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useCreateProposal,
  useCustomFields,
  useDealEstimates,
  useDealProposals,
  useDeleteProposal,
  useProposalMeta,
  useProposalRender,
  useProposalTemplates,
  useSendProposal,
  useTemplateVariables,
  useUpdateProposal,
} from '@/lib/api/hooks';
import type { CanvasPage, Proposal, ProposalStatus, ProposalTheme } from '@/lib/api/proposals';
import { ProposalCanvasEditor, toCanvasPages, type FieldOption } from './ProposalCanvasEditor';
import { buildDealCtx } from './dealCtx';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100);

const STATUS_COLOR: Record<ProposalStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  viewed: 'cyan',
  accepted: 'teal',
  denied: 'red',
  deferred: 'yellow',
};

export function DealProposals({ dealId }: { dealId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (selected) return <ProposalBuilder id={selected} onBack={() => setSelected(null)} />;
  return <ProposalList dealId={dealId} onOpen={setSelected} />;
}

function ProposalList({ dealId, onOpen }: { dealId: string; onOpen: (id: string) => void }) {
  const { data: proposals = [], isLoading } = useDealProposals(dealId);
  const del = useDeleteProposal();
  const [opened, ctl] = useDisclosure(false);

  const remove = (p: Proposal) => {
    if (!window.confirm(`Delete proposal "${p.title}"?`)) return;
    del.mutate(p.id, { onSuccess: () => notifications.show({ message: 'Proposal deleted', color: 'green' }), onError: fail });
  };

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Proposals</Text>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={ctl.open}>
          New proposal
        </Button>
      </Group>

      {isLoading ? (
        <Loader size="sm" />
      ) : proposals.length === 0 ? (
        <Text size="sm" c="dimmed">
          No proposals yet. Create one from a template.
        </Text>
      ) : (
        <Stack gap="xs">
          {proposals.map((p) => (
            <Paper key={p.id} withBorder radius="sm" p="xs">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => onOpen(p.id)}>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={500} lineClamp={1}>
                      {p.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Updated {new Date(p.updatedAt).toLocaleDateString()}
                    </Text>
                  </div>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Badge variant="light" color={STATUS_COLOR[p.status]} style={{ textTransform: 'none' }}>
                    {p.status}
                  </Badge>
                  <Menu position="bottom-end" withinPortal shadow="sm">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => onOpen(p.id)}>Open</Menu.Item>
                      <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(p)}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <NewProposalModal opened={opened} onClose={ctl.close} dealId={dealId} onCreated={onOpen} />
    </Card>
  );
}

function NewProposalModal({
  opened,
  onClose,
  dealId,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  dealId: string;
  onCreated: (id: string) => void;
}) {
  const { data: templates = [] } = useProposalTemplates();
  const { data: estimates = [] } = useDealEstimates(dealId);
  const create = useCreateProposal();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [estimateIds, setEstimateIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');

  const submit = () => {
    if (!templateId) {
      notifications.show({ message: 'Pick a template', color: 'red' });
      return;
    }
    create.mutate(
      { dealId, templateId, estimateIds, title: title.trim() || undefined },
      {
        onSuccess: (p) => {
          onClose();
          setTemplateId(null);
          setEstimateIds([]);
          setTitle('');
          onCreated(p.id);
        },
        onError: fail,
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New proposal" centered>
      <Stack>
        <Select
          label="Template"
          required
          placeholder={templates.length === 0 ? 'Create a template in Settings → Proposals' : 'Pick a template'}
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={templateId}
          onChange={setTemplateId}
        />
        <MultiSelect
          label="Include estimate(s)"
          description="Their line items + totals fill the pricing block."
          placeholder={estimates.length === 0 ? 'No estimates on this deal yet' : 'Select estimates'}
          data={estimates.map((e) => ({
            value: e.id,
            label: `${e.docNumber ? `#${e.docNumber}` : 'Estimate'} · ${money(e.totalAmount, e.currency)}`,
          }))}
          value={estimateIds}
          onChange={setEstimateIds}
        />
        <TextInput label="Title" placeholder="Defaults to the deal title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Button onClick={submit} loading={create.isPending}>
          Create &amp; open
        </Button>
      </Stack>
    </Modal>
  );
}

function ProposalBuilder({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useProposalRender(id);
  const { data: estimates = [] } = useDealEstimates(data?.dealId ?? '');
  const { data: variables = [] } = useTemplateVariables();
  const { data: dealFields = [] } = useCustomFields('deal');
  const { data: meta } = useProposalMeta();
  const update = useUpdateProposal();
  const sendMut = useSendProposal();

  const shareLink = () => (typeof window !== 'undefined' && data ? `${window.location.origin}/proposal/${data.shareToken}` : '');
  const copyLink = async () => {
    await navigator.clipboard.writeText(shareLink());
    notifications.show({ message: 'Presentation link copied', color: 'green' });
  };
  const send = () =>
    sendMut.mutate(
      { id },
      {
        onSuccess: (r) =>
          notifications.show({ message: r.emailed ? 'Proposal sent to the customer' : 'Marked sent — copy the link to share it', color: 'green' }),
        onError: fail,
      },
    );
  const [title, setTitle] = useState('');
  const [estimateIds, setEstimateIds] = useState<string[]>([]);
  const [pages, setPages] = useState<CanvasPage[]>([]);
  const [theme, setTheme] = useState<ProposalTheme | null>(null);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setEstimateIds(data.estimateIds);
    setTheme({ orientation: 'portrait', ...data.theme });
    const p = toCanvasPages(data.content);
    setPages(p.length ? p : [{ id: `${Date.now()}`, elements: [] }]);
  }, [data]);

  const ctx = useMemo(() => (data ? buildDealCtx(data) : null), [data]);
  const imageFields: FieldOption[] = useMemo(
    () => dealFields.filter((f) => f.type === 'image').map((f) => ({ value: f.key, label: f.label })),
    [dealFields],
  );
  const documentFields: FieldOption[] = useMemo(
    () => dealFields.filter((f) => f.type === 'document').map((f) => ({ value: f.key, label: f.label })),
    [dealFields],
  );

  const save = () =>
    theme &&
    update.mutate(
      { id, body: { title: title.trim(), estimateIds, content: pages, theme } },
      { onSuccess: () => notifications.show({ message: 'Proposal saved', color: 'green' }), onError: fail },
    );

  if (isLoading || !data || !theme || !ctx) {
    return (
      <Card withBorder radius="md" padding="md">
        <Loader size="sm" />
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Button variant="subtle" size="xs" leftSection={<IconArrowLeft size={14} />} onClick={onBack}>
          All proposals
        </Button>
        <Group gap="xs">
          <Badge variant="light" color={STATUS_COLOR[data.status]} style={{ textTransform: 'none' }}>
            {data.status}
          </Badge>
          <Button size="xs" variant="default" leftSection={<IconLink size={14} />} onClick={copyLink}>
            Copy link
          </Button>
          <Button size="xs" variant="default" leftSection={<IconSend size={14} />} onClick={send} loading={sendMut.isPending}>
            Send
          </Button>
          <Button size="xs" leftSection={<IconDeviceFloppy size={14} />} onClick={save} loading={update.isPending}>
            Save
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Group grow align="flex-start">
          <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <MultiSelect
            label="Estimates"
            description="Save to refresh pricing blocks."
            data={estimates.map((e) => ({
              value: e.id,
              label: `${e.docNumber ? `#${e.docNumber}` : 'Estimate'} · ${money(e.totalAmount, e.currency)}`,
            }))}
            value={estimateIds}
            onChange={setEstimateIds}
          />
        </Group>
      </Card>

      <ProposalCanvasEditor
        pages={pages}
        onPagesChange={setPages}
        theme={theme}
        onThemeChange={setTheme}
        variables={variables}
        fonts={meta?.fonts ?? []}
        ctx={ctx}
        imageFields={imageFields}
        documentFields={documentFields}
        imageFilesByField={data.imagesByField}
        documentFilesByField={data.documentsByField}
        enforceLocks
      />
    </Stack>
  );
}
