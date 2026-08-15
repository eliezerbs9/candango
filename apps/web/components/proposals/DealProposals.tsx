'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconChevronDown, IconDots, IconLink, IconPlus, IconPrinter, IconSend, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useCreateEstimate,
  useCreateProposal,
  useCustomFields,
  useDeal,
  useDealEstimates,
  useDealInvoices,
  useDealParticipants,
  useDealProposals,
  useDeleteProposal,
  useEstimateItems,
  useFileUrls,
  useOrganization,
  useQbItems,
  useQuickbooksStatus,
  useProposalMeta,
  useProposalPreviewData,
  useProposalRender,
  useProposalTemplates,
  useSendProposal,
  useTemplateVariables,
  useUpdateProposal,
} from '@/lib/api/hooks';
import type { CanvasElement, CanvasPage, PricingDocRef, Proposal, ProposalBody, ProposalFieldDef, ProposalStatus, ProposalTheme } from '@/lib/api/proposals';
import type { DealDoc } from '@/lib/api/types';
import { useAutosave } from '@/lib/useAutosave';
import { DocEditorModal } from '@/components/deals/quickbooks/DocEditorModal';
import { ProposalCanvasEditor, toCanvasPages, type FieldOption } from './ProposalCanvasEditor';
import { ProposalFieldsFiller } from './ProposalFields';
import { ProposalMiniPreview } from './ProposalMiniPreview';
import { SaveStatus } from './SaveStatus';
import { buildDealCtx } from './dealCtx';
import { buildPreviewCtx } from './previewCtx';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100);

/** Compact date + time for the proposal card timeline (e.g. "Aug 6, 2026, 9:08 PM"). */
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Object keys held by a deal image/document custom field (image = string[], document = {key}[]). */
function dealFileKeys(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : (x as { key?: string })?.key)).filter((k): k is string => !!k);
}

/** Distinct estimate/invoice ids referenced across all Pricing elements. */
function pricingDocIds(pages: CanvasPage[]): { estimate: string[]; invoice: string[] } {
  const est = new Set<string>();
  const inv = new Set<string>();
  for (const p of pages) {
    for (const el of p.elements ?? []) {
      if (el.type !== 'pricing') continue;
      for (const d of (el.props?.docs as PricingDocRef[] | undefined) ?? []) {
        (d.kind === 'invoice' ? inv : est).add(d.id);
      }
    }
  }
  return { estimate: [...est], invoice: [...inv] };
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
  const router = useRouter();
  // A proposal opens at its own deal-nested route (keeps the deal header + tabs), like the doc builder.
  return <ProposalList dealId={dealId} onOpen={(id) => router.push(`/deals/${dealId}/proposals/${id}`)} />;
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
  const update = useUpdateProposal();
  const [opened, ctl] = useDisclosure(false);
  // Manual status change (e.g. a proposal presented in person, not emailed). Declining/deferring
  // asks for a required reason first, just like the builder header.
  const [reasonTarget, setReasonTarget] = useState<{ id: string; status: ProposalStatus } | null>(null);
  const [reason, setReason] = useState('');
  const changeStatus = (p: Proposal, s: ProposalStatus) => {
    if (s === p.status) return;
    if (s === 'denied' || s === 'deferred') {
      setReason('');
      setReasonTarget({ id: p.id, status: s });
      return;
    }
    update.mutate({ id: p.id, body: { status: s } }, { onSuccess: () => notifications.show({ message: `Marked ${STATUS_LABEL[s].toLowerCase()}`, color: 'green' }), onError: fail });
  };
  const submitReason = () => {
    if (!reasonTarget) return;
    if (!reason.trim()) {
      notifications.show({ message: 'Add a reason', color: 'red' });
      return;
    }
    update.mutate(
      { id: reasonTarget.id, body: { status: reasonTarget.status, feedback: reason.trim() } },
      { onSuccess: () => { notifications.show({ message: `Marked ${STATUS_LABEL[reasonTarget.status].toLowerCase()}`, color: 'green' }); setReasonTarget(null); }, onError: fail },
    );
  };
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
            <Card
              key={p.id}
              withBorder
              radius="md"
              p={0}
              h="100%"
              style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              onClick={() => onOpen(p.id)}
            >
              <div style={{ position: 'relative' }}>
                <ProposalMiniPreview layout={p.content} theme={p.theme} ctx={thumbCtx} height={170} />
                <Badge
                  variant="filled"
                  color={STATUS_COLOR[p.status]}
                  style={{ position: 'absolute', top: 8, right: 8, textTransform: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
                >
                  {STATUS_LABEL[p.status]}
                </Badge>
              </div>

              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Group justify="space-between" wrap="nowrap" gap="xs">
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
                      <Menu.Divider />
                      <Menu.Label>Set status</Menu.Label>
                      {STATUS_OPTIONS.map((s) => (
                        <Menu.Item
                          key={s}
                          disabled={s === p.status}
                          onClick={(e) => { e.stopPropagation(); changeStatus(p, s); }}
                        >
                          {STATUS_LABEL[s]}
                        </Menu.Item>
                      ))}
                      <Menu.Divider />
                      <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={(e) => { e.stopPropagation(); remove(p); }}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>

                {/* Journey: created → sent → viewed → decided (mirrors the signature cards). */}
                <Stack gap={1} mt={8}>
                  <Text size="xs" c="dimmed">Created {fmtDateTime(p.createdAt)}</Text>
                  {p.sentAt && <Text size="xs" c="dimmed">Sent {fmtDateTime(p.sentAt)}</Text>}
                  {p.viewedAt && <Text size="xs" c="dimmed">Viewed {fmtDateTime(p.viewedAt)}</Text>}
                  {p.respondedAt && (
                    <Text size="xs" c={p.status === 'denied' ? 'red' : p.status === 'accepted' ? 'teal.7' : 'yellow.7'}>
                      {STATUS_LABEL[p.status]} {fmtDateTime(p.respondedAt)}
                    </Text>
                  )}
                </Stack>

                <Group justify="space-between" align="center" mt="auto" pt="sm" wrap="nowrap">
                  <Text size="xs" c="dimmed">
                    {p.total ? 'Total' : 'No estimate'}
                  </Text>
                  {p.total ? (
                    <Text fw={700} size="sm">
                      {money(p.total, p.currency ?? 'USD')}
                    </Text>
                  ) : null}
                </Group>
              </div>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <NewProposalModal opened={opened} onClose={ctl.close} dealId={dealId} onCreated={onOpen} />

      <Modal
        opened={!!reasonTarget}
        onClose={() => setReasonTarget(null)}
        title={reasonTarget?.status === 'denied' ? 'Decline proposal' : 'Defer proposal'}
        centered
      >
        <Stack>
          <Textarea
            label="Reason"
            description="Recorded on the deal timeline and used by automations."
            required
            autosize
            minRows={3}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            placeholder={reasonTarget?.status === 'denied' ? 'Why was it declined?' : 'Why is the decision deferred, and until when?'}
          />
          <Button onClick={submitReason} loading={update.isPending}>
            Mark {reasonTarget ? STATUS_LABEL[reasonTarget.status].toLowerCase() : ''}
          </Button>
        </Stack>
      </Modal>
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
  const create = useCreateProposal();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  const submit = () => {
    if (!templateId) {
      notifications.show({ message: 'Pick a template', color: 'red' });
      return;
    }
    create.mutate(
      { dealId, templateId, title: title.trim() || undefined },
      {
        onSuccess: (p) => {
          onClose();
          setTemplateId(null);
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
        <Text size="xs" c="dimmed">
          Add estimates/invoices later from the proposal&apos;s Pricing elements.
        </Text>
        <TextInput label="Title" placeholder="Defaults to the deal title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Button onClick={submit} loading={create.isPending}>
          Create &amp; open
        </Button>
      </Stack>
    </Modal>
  );
}

/** A pricing element's estimate/invoice picker (deal builder): attach existing docs or create one inline. */
function PricingDocsEditor({
  dealId,
  currency,
  value,
  onChange,
  estimateLimit = Infinity,
  invoiceLimit = Infinity,
  totalEstimates = 0,
  totalInvoices = 0,
  kind,
  lockedDocs = [],
}: {
  dealId: string;
  currency: string;
  value: PricingDocRef[];
  onChange: (docs: PricingDocRef[]) => void;
  /** Max estimates/invoices across the whole proposal (a single-limit estimate/invoice internal field). */
  estimateLimit?: number;
  invoiceLimit?: number;
  /** Current distinct estimate/invoice count across all pricing elements. */
  totalEstimates?: number;
  totalInvoices?: number;
  /** Constrain to a single kind (estimate/invoice internal fields); undefined = both (a Pricing element). */
  kind?: PricingDocRef['kind'];
  /** Read-only docs linked elsewhere (e.g. via a Pricing element) — shown but not removable here. */
  lockedDocs?: PricingDocRef[];
}) {
  const { data: estimates = [] } = useDealEstimates(dealId);
  const { data: invoices = [] } = useDealInvoices(dealId);
  const { data: org } = useOrganization();
  const { data: qb } = useQuickbooksStatus();
  const { data: deal } = useDeal(dealId);
  const createEstimate = useCreateEstimate(dealId);
  const [editorOpen, editorCtl] = useDisclosure(false);

  // Estimate creation must mirror the Estimates tab: QuickBooks when connected+linked, native otherwise.
  const connected = !!qb?.connected;
  const linked = !!deal?.qbSubcustomerId;
  const mode: 'native' | 'link' | 'qbo' = !connected ? 'native' : linked ? 'qbo' : 'link';
  const { data: qbItems } = useQbItems(dealId, mode === 'qbo');
  const { data: localItems = [] } = useEstimateItems();
  const itemList =
    mode === 'qbo'
      ? qbItems
      : localItems.map((i) => ({ id: i.id, name: i.name, description: i.description, unit: i.unit, unitPrice: i.unitPrice }));
  const taxRatePct = mode === 'qbo' ? undefined : (org?.taxRateBps ?? 0) / 100;

  const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const docs = value ?? [];
  // A doc is already linked if it's an editable row here OR a read-only (Pricing-sourced) row.
  const has = (dk: PricingDocRef['kind'], docId: string) =>
    docs.some((d) => d.kind === dk && d.id === docId) || lockedDocs.some((d) => d.kind === dk && d.id === docId);
  const fmt = (noun: string, doc: DealDoc) =>
    `${noun}${doc.docNumber ? ` #${doc.docNumber}` : ''} · ${money(doc.totalAmount, doc.currency)} · ${cap(doc.status)}`;
  const label = (d: PricingDocRef) => {
    const doc = (d.kind === 'estimate' ? estimates : invoices).find((x) => x.id === d.id);
    const noun = d.kind === 'estimate' ? 'Estimate' : 'Invoice';
    return doc ? fmt(noun, doc) : noun;
  };
  const addOptions = [
    ...(kind !== 'invoice' ? estimates.filter((e) => !has('estimate', e.id)).map((e) => ({ value: `estimate:${e.id}`, label: fmt('Estimate', e) })) : []),
    ...(kind !== 'estimate' ? invoices.filter((iv) => !has('invoice', iv.id)).map((iv) => ({ value: `invoice:${iv.id}`, label: fmt('Invoice', iv) })) : []),
  ];
  const showCreate = kind !== 'invoice'; // invoices are created only by converting estimates

  // A single-limit estimate/invoice internal field caps the whole proposal (not just this element).
  const estimateAtLimit = totalEstimates >= estimateLimit;
  const invoiceAtLimit = totalInvoices >= invoiceLimit;
  const overLimitMsg = (kind: PricingDocRef['kind']) =>
    `Only ${kind === 'estimate' ? estimateLimit : invoiceLimit} ${kind} allowed on this proposal (an internal field limits it).`;

  return (
    <Stack gap={8}>
      <Text size="xs" c="dimmed">
        {kind
          ? `${kind === 'estimate' ? 'Estimates' : 'Invoices'} linked to this proposal.`
          : "Estimates & invoices shown in this pricing block. Empty ⇒ the proposal's default estimates."}
      </Text>
      {(docs.length > 0 || lockedDocs.length > 0) && (
        <Stack gap={4}>
          {/* Read-only rows: linked via a Pricing element — remove them there, not here. */}
          {lockedDocs.map((d, i) => (
            <Group key={`locked:${d.kind}:${d.id}:${i}`} justify="space-between" wrap="nowrap" gap="xs">
              <Text size="xs" c="dimmed" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label(d)}
              </Text>
              <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                Pricing
              </Badge>
            </Group>
          ))}
          {docs.map((d, i) => (
            <Group key={`${d.kind}:${d.id}:${i}`} justify="space-between" wrap="nowrap" gap="xs">
              <Text size="xs" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label(d)}
              </Text>
              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onChange(docs.filter((_, idx) => idx !== i))} aria-label="Remove">
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
      <Select
        size="xs"
        placeholder={kind === 'invoice' ? 'Add existing invoice' : kind === 'estimate' ? 'Add existing estimate' : 'Add existing estimate / invoice'}
        data={addOptions}
        value={null}
        onChange={(v) => {
          if (!v) return;
          const [dkind, docId] = v.split(':') as [PricingDocRef['kind'], string];
          if (dkind === 'estimate' ? estimateAtLimit : invoiceAtLimit) {
            notifications.show({ message: overLimitMsg(dkind), color: 'red' });
            return;
          }
          onChange([...docs, { kind: dkind, id: docId }]);
        }}
        searchable
        nothingFoundMessage="Nothing to add"
        comboboxProps={{ withinPortal: true }}
      />
      {showCreate && (
        <Tooltip label={overLimitMsg('estimate')} disabled={!estimateAtLimit} withArrow multiline w={230}>
          <span style={{ display: 'inline-block', alignSelf: 'flex-start' }}>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={13} />}
              onClick={editorCtl.open}
              disabled={estimateAtLimit}
            >
              {/* Unlinked or no-QuickBooks deals fall back to a native estimate. */}
              {mode === 'qbo' ? 'Create QuickBooks estimate' : 'Create estimate'}
            </Button>
          </span>
        </Tooltip>
      )}
      <DocEditorModal
        opened={editorOpen}
        onClose={editorCtl.close}
        title={mode === 'qbo' ? 'New QuickBooks estimate' : 'New estimate'}
        currency={currency}
        loading={createEstimate.isPending}
        items={itemList}
        taxRatePct={taxRatePct}
        taxDefaultOn={org?.taxDefaultOn}
        submitLabel="Create & attach"
        onSubmit={async (input) => {
          const est = await createEstimate.mutateAsync(input);
          onChange([...docs, { kind: 'estimate', id: est.id }]);
        }}
      />
    </Stack>
  );
}

export function ProposalBuilder({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading } = useProposalRender(id);
  const { data: deal } = useDeal(data?.dealId ?? '');
  const { data: participants = [] } = useDealParticipants(data?.dealId ?? '');
  // A proposal emails the deal's primary contact — block Send if they have no email.
  const primaryContact = participants.find((p) => p.source === 'deal-primary');
  const contactMissingEmail = participants.length > 0 && !primaryContact?.email;
  // Back / after-send returns to the deal's Proposals tab (the list).
  const onBack = () => router.push(data ? `/deals/${data.dealId}/proposals` : '/deals');
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
        onSuccess: (r) => {
          notifications.show({ message: r.emailed ? 'Proposal sent to the customer' : 'Marked sent — copy the link to share it', color: 'green' });
          onBack(); // back to the proposals list
        },
        onError: fail,
      },
    );
  const [title, setTitle] = useState('');
  const [estimateIds, setEstimateIds] = useState<string[]>([]);
  const [pages, setPages] = useState<CanvasPage[]>([]);
  const [theme, setTheme] = useState<ProposalTheme | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
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
    setFieldValues(data.fieldValues ?? {});
    setHydrated(true);
  }, [data, hydrated]);

  const status = useAutosave(
    { title: title.trim(), estimateIds, content: pages, theme, fieldValues },
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

  // Internal fields gate Send (the API enforces this too). `data.fields` is client-hidden.
  // document/image resolve from the bound deal custom field; estimate/invoice from the Pricing elements.
  const blank = (v: unknown) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
  const dealCf = (deal?.customFields ?? {}) as Record<string, unknown>;
  // Every estimate/invoice the proposal references: Pricing elements ∪ estimate/invoice fields ∪ legacy estimateIds.
  const linkedPricing = useMemo(() => {
    const ids = pricingDocIds(pages);
    const est = new Set<string>([...ids.estimate, ...estimateIds]);
    const inv = new Set<string>(ids.invoice);
    for (const f of data?.fields ?? []) {
      const raw = fieldValues[f.key];
      if (f.type === 'estimate' && Array.isArray(raw)) raw.forEach((id) => typeof id === 'string' && est.add(id));
      if (f.type === 'invoice' && Array.isArray(raw)) raw.forEach((id) => typeof id === 'string' && inv.add(id));
    }
    return { estimate: [...est], invoice: [...inv] };
  }, [pages, estimateIds, data?.fields, fieldValues]);
  const pricingCounts = { estimate: linkedPricing.estimate.length, invoice: linkedPricing.invoice.length };
  const fieldCount = (f: ProposalFieldDef) => {
    if (f.type === 'estimate') return pricingCounts.estimate;
    if (f.type === 'invoice') return pricingCounts.invoice;
    if (f.type === 'document' || f.type === 'image') {
      const keys = f.customFieldKey ? dealFileKeys(dealCf[f.customFieldKey]) : [];
      const sel = fieldValues[f.key];
      if (f.multiple === false) {
        return typeof sel === 'string' && keys.includes(sel) ? 1 : 0;
      }
      return Array.isArray(sel) ? sel.filter((k) => typeof k === 'string' && keys.includes(k)).length : 0;
    }
    return blank(fieldValues[f.key]) ? 0 : 1;
  };
  const missingRequired = useMemo(() => {
    const out: string[] = [];
    for (const f of data?.fields ?? []) {
      const n = fieldCount(f);
      if (f.required && n === 0) {
        out.push(f.type === 'estimate' || f.type === 'invoice' ? `Add ${f.type === 'estimate' ? 'an estimate' : 'an invoice'} (${f.label})` : `Fill: ${f.label}`);
      }
      if (['document', 'image', 'estimate', 'invoice'].includes(f.type) && f.multiple === false && n > 1) {
        out.push(`${f.label}: only one allowed (you have ${n})`);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.fields, fieldValues, dealCf, pricingCounts]);
  // Single-limit estimate/invoice fields cap how many the Pricing elements may reference.
  const estimateLimit = (data?.fields ?? []).some((f) => f.type === 'estimate' && f.multiple === false) ? 1 : Infinity;
  const invoiceLimit = (data?.fields ?? []).some((f) => f.type === 'invoice' && f.multiple === false) ? 1 : Infinity;

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
          <Tooltip
            label={
              contactMissingEmail
                ? "The deal's primary contact has no email — add one to send the proposal."
                : `Fill required internal field${missingRequired.length > 1 ? 's' : ''} first: ${missingRequired.join(', ')}`
            }
            disabled={!contactMissingEmail && missingRequired.length === 0}
            withArrow
            multiline
            w={260}
          >
            <span style={{ display: 'inline-block' }}>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconSend size={14} />}
                onClick={send}
                loading={sendMut.isPending}
                disabled={missingRequired.length > 0 || contactMissingEmail}
              >
                Send
              </Button>
            </span>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Group grow align="flex-end" wrap="nowrap">
          <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <div>
            <Text size="sm" fw={500}>
              Deal value
            </Text>
            <Text fw={700} size="lg">
              {deal ? money(deal.value, deal.currency) : '—'}
            </Text>
          </div>
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
        renderPricingDocs={(el: CanvasElement, onProp) => (
          <PricingDocsEditor
            dealId={data.dealId}
            currency={estimates[0]?.currency ?? 'USD'}
            value={(el.props.docs as PricingDocRef[] | undefined) ?? []}
            onChange={(docs) => onProp('docs', docs)}
            estimateLimit={estimateLimit}
            invoiceLimit={invoiceLimit}
            totalEstimates={pricingCounts.estimate}
            totalInvoices={pricingCounts.invoice}
          />
        )}
        rightPanelExtra={
          data.fields && data.fields.length > 0 ? (
            <ProposalFieldsFiller
              dealId={data.dealId}
              fields={data.fields}
              values={fieldValues}
              onChange={setFieldValues}
              pricingCounts={pricingCounts}
              renderPricingField={(field, value, onFieldChange) => {
                const dk = field.type as PricingDocRef['kind'];
                const ids = Array.isArray(value) ? (value as string[]) : [];
                // Estimates/invoices linked via a Pricing element (not added directly here) — shown read-only.
                const lockedDocs = pricingDocIds(pages)[dk].filter((idv) => !ids.includes(idv)).map((idv) => ({ kind: dk, id: idv }));
                return (
                  <PricingDocsEditor
                    dealId={data.dealId}
                    currency={estimates[0]?.currency ?? 'USD'}
                    kind={dk}
                    value={ids.map((idv) => ({ kind: dk, id: idv }))}
                    onChange={(docs) => onFieldChange(docs.map((d) => d.id))}
                    estimateLimit={estimateLimit}
                    invoiceLimit={invoiceLimit}
                    totalEstimates={pricingCounts.estimate}
                    totalInvoices={pricingCounts.invoice}
                    lockedDocs={lockedDocs}
                  />
                );
              }}
            />
          ) : undefined
        }
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
