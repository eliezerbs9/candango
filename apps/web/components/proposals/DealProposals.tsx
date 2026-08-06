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
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconChevronDown, IconDots, IconLink, IconPlus, IconPrinter, IconSend, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useCreateProposal,
  useCustomFields,
  useDealEstimates,
  useDealProposals,
  useDeleteProposal,
  useFileUrls,
  useOrganization,
  useProposalMeta,
  useProposalPreviewData,
  useProposalRender,
  useProposalTemplates,
  useSendProposal,
  useTemplateVariables,
  useUpdateProposal,
} from '@/lib/api/hooks';
import type { CanvasPage, Proposal, ProposalBody, ProposalStatus, ProposalTheme } from '@/lib/api/proposals';
import type { DealDoc } from '@/lib/api/types';
import { useAutosave } from '@/lib/useAutosave';
import { ProposalCanvasEditor, toCanvasPages, type FieldOption } from './ProposalCanvasEditor';
import { ProposalMiniPreview } from './ProposalMiniPreview';
import { SaveStatus } from './SaveStatus';
import { buildDealCtx } from './dealCtx';
import { buildPreviewCtx } from './previewCtx';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100);

const ESTIMATE_STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'teal',
  rejected: 'red',
  closed: 'dark',
};

/** Rich estimate option: number · total · status · created date. */
function makeEstimateRenderer(estimates: DealDoc[]) {
  const byId = new Map(estimates.map((e) => [e.id, e]));
  return ({ option }: { option: { value: string; label: string } }) => {
    const e = byId.get(option.value);
    if (!e) return option.label;
    return (
      <div style={{ minWidth: 0 }}>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={500}>
            {e.docNumber ? `#${e.docNumber}` : 'Estimate'}
          </Text>
          <Text size="sm">{money(e.totalAmount, e.currency)}</Text>
          <Badge size="xs" variant="light" color={ESTIMATE_STATUS_COLOR[e.status] ?? 'gray'} style={{ textTransform: 'none' }}>
            {e.status}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          Created {new Date(e.createdAt).toLocaleDateString()}
        </Text>
      </div>
    );
  };
}

const STATUS_COLOR: Record<ProposalStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  viewed: 'cyan',
  accepted: 'teal',
  denied: 'red',
  deferred: 'yellow',
};

const STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  denied: 'Declined',
  deferred: 'Deferred',
};
const STATUS_OPTIONS: ProposalStatus[] = ['draft', 'sent', 'viewed', 'accepted', 'denied', 'deferred'];

export function DealProposals({ dealId }: { dealId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (selected) return <ProposalBuilder id={selected} onBack={() => setSelected(null)} />;
  return <ProposalList dealId={dealId} onOpen={setSelected} />;
}

const isCanvasPage = (p: unknown): p is CanvasPage => !!p && Array.isArray((p as CanvasPage).elements);

/** Fixed file keys on a proposal's FIRST page — imported page background + uploaded image element files. */
function firstPageFileKeys(content: unknown): string[] {
  const page = (Array.isArray(content) ? content : []).find(isCanvasPage);
  if (!page) return [];
  const keys: string[] = [];
  if (page.background) keys.push(page.background);
  for (const el of page.elements) {
    if ((el.props as { source?: string })?.source !== 'fixed') continue;
    const files = (el.props as { files?: { key?: string }[] })?.files;
    if (Array.isArray(files)) for (const f of files) if (f?.key) keys.push(f.key);
  }
  return keys;
}

function ProposalList({ dealId, onOpen }: { dealId: string; onOpen: (id: string) => void }) {
  const { data: proposals = [], isLoading } = useDealProposals(dealId);
  const { data: variables = [] } = useTemplateVariables();
  const { data: org } = useOrganization();
  const { data: preview } = useProposalPreviewData(dealId); // real deal data (contact, company, images) for the thumbnails
  const del = useDeleteProposal();
  const [opened, ctl] = useDisclosure(false);
  // Page-backgrounds (imported PDF pages) aren't in preview.fixedFilesByKey — presign them separately.
  const fixedKeys = useMemo(() => Array.from(new Set(proposals.flatMap((p) => firstPageFileKeys(p.content)))), [proposals]);
  const fileUrlByKey = useFileUrls(fixedKeys);
  // Render thumbnails against the REAL deal (actual contact name, images, pricing); fall back to example data while it loads.
  const thumbCtx = useMemo(() => {
    if (preview) {
      const base = buildDealCtx(preview);
      return { ...base, fileUrl: (k: string) => base.fileUrl(k) ?? fileUrlByKey[k] };
    }
    return buildPreviewCtx(Object.fromEntries(variables.map((v) => [v.key, v.example])), fileUrlByKey, org?.logoUrl);
  }, [preview, variables, fileUrlByKey, org?.logoUrl]);

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
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {proposals.map((p) => (
            <Card key={p.id} withBorder radius="md" padding="md" style={{ cursor: 'pointer' }} onClick={() => onOpen(p.id)}>
              <ProposalMiniPreview layout={p.content} theme={p.theme} ctx={thumbCtx} height={170} />

              <Group justify="space-between" wrap="nowrap" mt="sm" mb={4}>
                <Text fw={600} lineClamp={1}>
                  {p.title}
                </Text>
                <Menu position="bottom-end" withinPortal shadow="sm">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" aria-label="Actions" onClick={(e) => e.stopPropagation()}>
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={(e) => { e.stopPropagation(); onOpen(p.id); }}>Open</Menu.Item>
                    <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={(e) => { e.stopPropagation(); remove(p); }}>
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>

              <Group justify="space-between" wrap="nowrap">
                <Badge variant="light" color={STATUS_COLOR[p.status]} style={{ textTransform: 'none' }}>
                  {p.status}
                </Badge>
                {p.total ? (
                  <Text fw={600} size="sm">
                    {money(p.total, p.currency ?? 'USD')}
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    No estimate
                  </Text>
                )}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
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
          renderOption={makeEstimateRenderer(estimates)}
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
  const [hydrated, setHydrated] = useState(false);
  const [reasonFor, setReasonFor] = useState<ProposalStatus | null>(null); // open reason modal for denied/deferred
  const [reason, setReason] = useState('');

  // Change the proposal status. Declining/deferring asks for a required reason first.
  const changeStatus = (s: ProposalStatus) => {
    if (!data || s === data.status) return;
    if (s === 'denied' || s === 'deferred') {
      setReason('');
      setReasonFor(s);
      return;
    }
    update.mutate({ id, body: { status: s } }, { onSuccess: () => notifications.show({ message: `Marked ${STATUS_LABEL[s].toLowerCase()}`, color: 'green' }), onError: fail });
  };
  const submitReason = () => {
    if (!reasonFor) return;
    if (!reason.trim()) {
      notifications.show({ message: 'Add a reason', color: 'red' });
      return;
    }
    update.mutate(
      { id, body: { status: reasonFor, feedback: reason.trim() } },
      { onSuccess: () => { notifications.show({ message: `Marked ${STATUS_LABEL[reasonFor].toLowerCase()}`, color: 'green' }); setReasonFor(null); }, onError: fail },
    );
  };

  // Hydrate local editor state once; later render refetches (fresh pricing/images) must not clobber edits.
  useEffect(() => {
    if (!data || hydrated) return;
    setTitle(data.title);
    setEstimateIds(data.estimateIds);
    setTheme({ orientation: 'portrait', ...data.theme });
    const p = toCanvasPages(data.content);
    setPages(p.length ? p : [{ id: `${Date.now()}`, elements: [] }]);
    setHydrated(true);
  }, [data, hydrated]);

  const status = useAutosave(
    { title: title.trim(), estimateIds, content: pages, theme },
    async (v) => {
      try {
        await update.mutateAsync({ id, body: v as ProposalBody });
      } catch (e) {
        fail(e);
        throw e;
      }
    },
    hydrated && !!theme,
  );

  const ctx = useMemo(() => (data ? buildDealCtx(data) : null), [data]);
  const imageFields: FieldOption[] = useMemo(
    () => dealFields.filter((f) => f.type === 'image').map((f) => ({ value: f.key, label: f.label })),
    [dealFields],
  );
  const documentFields: FieldOption[] = useMemo(
    () => dealFields.filter((f) => f.type === 'document').map((f) => ({ value: f.key, label: f.label })),
    [dealFields],
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
          <SaveStatus status={status} />
          <Menu withinPortal position="bottom-end" shadow="md">
            <Menu.Target>
              <Badge
                variant="light"
                color={STATUS_COLOR[data.status]}
                rightSection={<IconChevronDown size={12} />}
                style={{ textTransform: 'none', cursor: 'pointer' }}
              >
                {STATUS_LABEL[data.status]}
              </Badge>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Set status</Menu.Label>
              {STATUS_OPTIONS.map((s) => (
                <Menu.Item key={s} disabled={s === data.status} onClick={() => changeStatus(s)}>
                  {STATUS_LABEL[s]}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Button size="xs" variant="default" leftSection={<IconLink size={14} />} onClick={copyLink}>
            Copy link
          </Button>
          <Button size="xs" variant="default" leftSection={<IconPrinter size={14} />} component="a" href={`/print/proposal/${data.dealId}/${id}`} target="_blank">
            Print
          </Button>
          <Button size="xs" variant="default" leftSection={<IconSend size={14} />} onClick={send} loading={sendMut.isPending}>
            Send
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Group grow align="flex-start">
          <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <MultiSelect
            label="Estimates"
            description="Pricing blocks refresh automatically."
            data={estimates.map((e) => ({
              value: e.id,
              label: `${e.docNumber ? `#${e.docNumber}` : 'Estimate'} · ${money(e.totalAmount, e.currency)}`,
            }))}
            renderOption={makeEstimateRenderer(estimates)}
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

      <Modal opened={!!reasonFor} onClose={() => setReasonFor(null)} title={reasonFor === 'denied' ? 'Decline proposal' : 'Defer proposal'} centered>
        <Stack>
          <Textarea
            label="Reason"
            description="Recorded on the deal timeline and used by automations."
            required
            autosize
            minRows={3}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            placeholder={reasonFor === 'denied' ? 'Why was it declined?' : 'Why is the decision deferred, and until when?'}
          />
          <Button onClick={submitReason} loading={update.isPending}>
            Mark {reasonFor ? STATUS_LABEL[reasonFor].toLowerCase() : ''}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
