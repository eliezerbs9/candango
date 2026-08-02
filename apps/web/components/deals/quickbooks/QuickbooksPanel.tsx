'use client';

import { useState } from 'react';
import { Alert, Anchor, Badge, Button, Card, Divider, Group, Stack, Text } from '@mantine/core';
import Link from 'next/link';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCurrencyDollar,
  IconFileInvoice,
  IconInfoCircle,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconSend,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  useCreateEstimate,
  useDealEstimates,
  useEstimateItems,
  useOrganization,
  useDealInvoices,
  useDeleteEstimate,
  useIncludeEstimatesInValue,
  useQbItems,
  useQuickbooksStatus,
  useSetEstimateStatus,
  useSetInvoiceStatus,
  useUpdateEstimate,
  useUpdateInvoice,
} from '@/lib/api/hooks';
import { useAuthStore } from '@/lib/auth/store';
import { ApiError } from '@/lib/api/client';
import { fetchDocPdf } from '@/lib/api/quickbooks';
import { runBusy } from '@/lib/ui/useBusy';
import type { ApiDeal, CreateDocInput, DealDoc } from '@/lib/api/types';
import { DocList, type DocAction } from './DocList';
import { DocEditorModal } from './DocEditorModal';
import { DocViewModal } from './DocViewModal';
import { LinkAccountModal } from './LinkAccountModal';
import { ConvertToInvoiceModal } from './ConvertToInvoiceModal';
import { MoveStageModal } from './MoveStageModal';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import type { EmailAttachment } from '@/lib/api/messages';

// 'closed' is terminal (set only by converting to an invoice) — not user-selectable.
const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'rejected'];
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'];

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export function QuickbooksPanel({ deal }: { deal: ApiDeal }) {
  const token = useAuthStore((s) => s.token);
  const { data: qb } = useQuickbooksStatus();
  const [linkOpen, linkCtl] = useDisclosure(false);
  const [estOpen, estCtl] = useDisclosure(false);
  const [invOpen, invCtl] = useDisclosure(false);
  const [convertOpen, convertCtl] = useDisclosure(false);
  const [stageOpen, stageCtl] = useDisclosure(false);

  const connected = !!qb?.connected;
  const linked = !!deal.qbSubcustomerId;
  const mode: 'native' | 'link' | 'qbo' = !connected ? 'native' : linked ? 'qbo' : 'link';
  // QBO-sourced docs are kept after a disconnect, but become read-only (can't edit/change status/send).
  const isReadOnlyDoc = (d: DealDoc) => !connected && d.source === 'quickbooks';

  const estimates = useDealEstimates(deal.id);
  const invoices = useDealInvoices(deal.id);
  const items = useQbItems(deal.id, mode === 'qbo');
  const estimateItems = useEstimateItems();
  const { data: org } = useOrganization();
  const createEstimate = useCreateEstimate(deal.id);
  const updateEstimate = useUpdateEstimate(deal.id);
  const updateInvoice = useUpdateInvoice(deal.id);
  const setEstStatus = useSetEstimateStatus(deal.id);
  const setInvStatus = useSetInvoiceStatus(deal.id);
  const includeEstimates = useIncludeEstimatesInValue(deal.id);

  const [estEditing, setEstEditing] = useState<DealDoc | null>(null);
  const [invEditing, setInvEditing] = useState<DealDoc | null>(null);
  const [view, setView] = useState<{ doc: DealDoc; kind: 'Estimate' | 'Invoice' } | null>(null);
  const [convertDoc, setConvertDoc] = useState<DealDoc | null>(null); // estimate being converted to an invoice
  const [composeOpen, composeCtl] = useDisclosure(false);
  const [compose, setCompose] = useState<{
    subject: string;
    attachments: EmailAttachment[];
    kind: 'estimate' | 'invoice';
    docIds: string[];
  } | null>(null);

  // QBO products when connected+linked; otherwise the org's local estimate-item catalog.
  const itemList =
    mode === 'qbo'
      ? items.data
      : (estimateItems.data ?? []).map((i) => ({ id: i.id, name: i.name, unitPrice: i.unitPrice }));
  // Local docs can apply the org tax rate; QBO computes its own tax.
  const taxRatePct = mode === 'qbo' ? undefined : (org?.taxRateBps ?? 0) / 100;
  const estimateDocs = estimates.data ?? [];
  const invoiceDocs = invoices.data ?? [];
  // Show the invoices section while connected, OR when disconnected docs were kept (read-only).
  const showInvoices = mode === 'qbo' || invoiceDocs.length > 0;
  const hasKeptQboDocs = !connected && [...estimateDocs, ...invoiceDocs].some((d) => d.source === 'quickbooks');

  // Connected → open the actual QuickBooks PDF; otherwise our own print page.
  const openDoc = async (doc: DealDoc, kind: 'estimate' | 'invoice') => {
    if (connected && doc.qbId) {
      const w = window.open('', '_blank');
      try {
        const blob = await runBusy('Loading from QuickBooks…', () => fetchDocPdf(token!, deal.id, kind, doc.id));
        const url = URL.createObjectURL(blob);
        if (w) w.location.href = url;
        else window.open(url, '_blank');
      } catch (e) {
        w?.close();
        fail(e);
      }
    } else {
      window.open(`/print/${kind}/${deal.id}/${doc.id}`, '_blank');
    }
  };

  const printMany = async (docs: DealDoc[], kind: 'estimate' | 'invoice') => {
    if (connected) {
      const entries = docs.map((doc) => ({ doc, w: window.open('', '_blank') }));
      await runBusy('Loading from QuickBooks…', () =>
        Promise.all(
          entries.map(async ({ doc, w }) => {
            try {
              if (doc.qbId) {
                const blob = await fetchDocPdf(token!, deal.id, kind, doc.id);
                if (w) w.location.href = URL.createObjectURL(blob);
              } else if (w) {
                w.location.href = `/print/${kind}/${deal.id}/${doc.id}`;
              }
            } catch {
              w?.close();
            }
          }),
        ),
      );
    } else {
      docs.forEach((doc) => window.open(`/print/${kind}/${deal.id}/${doc.id}`, '_blank'));
    }
  };

  // Open our email composer with the QBO PDF(s) attached and the contact prefilled.
  const startSend = async (docs: DealDoc[], kind: 'estimate' | 'invoice') => {
    if (!docs.length) return;
    try {
      const attachments = await runBusy('Loading from QuickBooks…', () =>
        Promise.all(
          docs.map(async (d) => ({
            filename: `${kind}-${d.docNumber ?? d.id}.pdf`,
            mimeType: 'application/pdf',
            contentBase64: await blobToBase64(await fetchDocPdf(token!, deal.id, kind, d.id)),
          })),
        ),
      );
      const label = kind === 'invoice' ? 'Invoice' : 'Estimate';
      const subject =
        docs.length === 1
          ? `${label}${docs[0].docNumber ? ` #${docs[0].docNumber}` : ''} — ${deal.title}`
          : `${docs.length} ${label.toLowerCase()}s — ${deal.title}`;
      setCompose({ subject, attachments, kind, docIds: docs.map((d) => d.id) });
      composeCtl.open();
    } catch (e) {
      fail(e);
    }
  };

  const valueToast = (include: boolean) => ({
    onSuccess: () =>
      notifications.show({ message: include ? 'Added to deal value' : 'Removed from deal value', color: 'green' }),
    onError: fail,
  });
  const markEstimates = (ids: string[], include: boolean) =>
    includeEstimates.mutate({ estimateIds: ids, include }, valueToast(include));

  const deleteEstimate = useDeleteEstimate(deal.id);
  const removeEstimate = (doc: DealDoc) => {
    if (!window.confirm(`Delete estimate ${doc.docNumber ? `#${doc.docNumber}` : ''}? This can't be undone.`)) return;
    deleteEstimate.mutate(doc.id, {
      onSuccess: () => notifications.show({ message: 'Estimate deleted', color: 'green' }),
      onError: fail,
    });
  };

  const submitEstimate = (input: CreateDocInput) =>
    estEditing ? updateEstimate.mutateAsync({ id: estEditing.id, body: input }) : createEstimate.mutateAsync(input);

  const editFromView = () => {
    if (!view) return;
    const { doc, kind } = view;
    setView(null);
    if (kind === 'Estimate') {
      setEstEditing(doc);
      estCtl.open();
    } else {
      setInvEditing(doc);
      invCtl.open();
    }
  };

  // Per-row actions (shown in each doc's ⋯ menu) — only the ones that apply to that doc.
  const estimateActions = (d: DealDoc): DocAction[] => {
    const ro = isReadOnlyDoc(d);
    const live = d.status !== 'closed' && !ro; // closed estimates are terminal
    const acts: DocAction[] = [];
    if (mode === 'qbo' && live)
      acts.push({ key: 'send', label: 'Send', icon: <IconSend size={14} />, onClick: () => startSend([d], 'estimate') });
    acts.push({ key: 'print', label: 'Print', icon: <IconPrinter size={14} />, onClick: () => printMany([d], 'estimate') });
    if (mode === 'qbo' && live)
      acts.push({ key: 'convert', label: 'Convert to invoice', icon: <IconReceipt size={14} />, onClick: () => { setConvertDoc(d); convertCtl.open(); } });
    if (live) {
      if (d.includeInValue) {
        // The value must stay backed by ≥1 estimate — only allow removing when there's more than one.
        if (estimateDocs.length > 1)
          acts.push({ key: 'value', label: 'Remove from deal value', icon: <IconX size={14} />, onClick: () => markEstimates([d.id], false) });
      } else {
        acts.push({ key: 'value', label: 'Add to deal value', icon: <IconCurrencyDollar size={14} />, onClick: () => markEstimates([d.id], true) });
      }
      acts.push({ key: 'delete', label: 'Delete', icon: <IconTrash size={14} />, color: 'red', onClick: () => removeEstimate(d) });
    }
    return acts;
  };

  const invoiceActions = (d: DealDoc): DocAction[] => {
    const acts: DocAction[] = [];
    if (!isReadOnlyDoc(d))
      acts.push({ key: 'send', label: 'Send', icon: <IconSend size={14} />, onClick: () => startSend([d], 'invoice') });
    acts.push({ key: 'print', label: 'Print', icon: <IconPrinter size={14} />, onClick: () => printMany([d], 'invoice') });
    return acts;
  };

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <IconFileInvoice size={18} />
            <Text fw={600}>Estimates{mode === 'qbo' ? ' & invoices' : ''}</Text>
            {connected && (
              <Badge size="xs" color="teal" variant="light">
                QuickBooks
              </Badge>
            )}
          </Group>
          {mode === 'link' && (
            <Button size="xs" variant="light" onClick={linkCtl.open}>
              Set up QuickBooks billing
            </Button>
          )}
        </Group>

        {mode === 'link' && (
          <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />}>
            QuickBooks is connected. Link this deal to a QuickBooks account to create estimates and invoices there.
          </Alert>
        )}

        {/* Estimates */}
        <Group justify="space-between">
          <Text fw={500}>Estimates</Text>
          {mode !== 'link' && (
            <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={() => { setEstEditing(null); estCtl.open(); }}>
              New estimate
            </Button>
          )}
        </Group>
        <DocList
          docs={estimateDocs}
          statuses={ESTIMATE_STATUSES}
          onSetStatus={(id, status) => setEstStatus.mutate({ id, status }, { onError: fail })}
          onOpen={(doc) => setView({ doc, kind: 'Estimate' })}
          isStatusLocked={(d) => d.status === 'closed' || isReadOnlyDoc(d)}
          emptyText={mode === 'link' ? 'Link the deal to add estimates.' : 'No estimates yet.'}
          connected={connected}
          actions={mode === 'link' ? undefined : estimateActions}
        />

        {/* Invoices — created only by converting estimates; shown read-only if kept after a disconnect */}
        {showInvoices && (
          <>
            <Divider />
            <Text fw={500}>Invoices</Text>
            <DocList
              docs={invoiceDocs}
              statuses={INVOICE_STATUSES}
              onSetStatus={(id, status) => setInvStatus.mutate({ id, status }, { onSuccess: () => stageCtl.open(), onError: fail })}
              onOpen={(doc) => setView({ doc, kind: 'Invoice' })}
              isStatusLocked={(d) => isReadOnlyDoc(d)}
              emptyText="No invoices yet — convert an estimate (⋯ → Convert to invoice)."
              connected={connected}
              actions={mode === 'qbo' ? invoiceActions : undefined}
            />
          </>
        )}

        {hasKeptQboDocs ? (
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />}>
            QuickBooks is disconnected. Estimates and invoices synced with it are kept here but read-only —
            reconnect in{' '}
            <Anchor component={Link} href="/settings/integrations">
              Settings → Integrations
            </Anchor>{' '}
            to edit or send them.
          </Alert>
        ) : (
          mode === 'native' && (
            <Text size="xs" c="dimmed">
              Connect QuickBooks in{' '}
              <Anchor component={Link} href="/settings/integrations" size="xs">
                Settings → Integrations
              </Anchor>{' '}
              to create invoices.
            </Text>
          )
        )}
      </Stack>

      <LinkAccountModal dealId={deal.id} dealTitle={deal.title} opened={linkOpen} onClose={linkCtl.close} />

      <ConvertToInvoiceModal
        dealId={deal.id}
        estimates={convertDoc ? [convertDoc] : []}
        currency={deal.currency}
        opened={convertOpen}
        onClose={() => {
          convertCtl.close();
          setConvertDoc(null);
        }}
        onConverted={() => {
          setConvertDoc(null);
          stageCtl.open(); // offer to move the deal in the pipeline after converting
        }}
      />

      <ComposeEmail
        opened={composeOpen}
        onClose={composeCtl.close}
        defaultDealId={deal.id}
        defaultSubject={compose?.subject}
        initialAttachments={compose?.attachments}
        onSent={() => {
          if (!compose) return;
          compose.docIds.forEach((id) =>
            compose.kind === 'invoice'
              ? setInvStatus.mutate({ id, status: 'sent' }, { onError: fail })
              : setEstStatus.mutate({ id, status: 'sent' }, { onError: fail }),
          );
          if (compose.kind === 'invoice') stageCtl.open();
        }}
      />

      <MoveStageModal
        dealId={deal.id}
        pipelineId={deal.pipelineId}
        currentStageId={deal.stageId}
        opened={stageOpen}
        onClose={stageCtl.close}
      />

      <DocViewModal
        doc={view?.doc ?? null}
        kind={view?.kind ?? 'Estimate'}
        opened={!!view}
        onClose={() => setView(null)}
        onEdit={
          view && !(view.kind === 'Estimate' && view.doc.status === 'closed') && !isReadOnlyDoc(view.doc)
            ? editFromView
            : undefined
        }
        onPrint={view ? () => openDoc(view.doc, view.kind === 'Invoice' ? 'invoice' : 'estimate') : undefined}
      />

      <DocEditorModal
        opened={estOpen}
        onClose={estCtl.close}
        title={estEditing ? 'Edit estimate' : 'New estimate'}
        submitLabel={estEditing ? 'Save' : 'Create'}
        currency={deal.currency}
        items={itemList}
        taxRatePct={taxRatePct}
        taxDefaultOn={org?.taxDefaultOn}
        initial={estEditing}
        loading={createEstimate.isPending || updateEstimate.isPending}
        onSubmit={submitEstimate}
      />
      <DocEditorModal
        opened={invOpen}
        onClose={invCtl.close}
        title="Edit invoice"
        submitLabel="Save"
        currency={deal.currency}
        items={itemList}
        taxRatePct={taxRatePct}
        taxDefaultOn={org?.taxDefaultOn}
        initial={invEditing}
        loading={updateInvoice.isPending}
        onSubmit={(input) => updateInvoice.mutateAsync({ id: invEditing!.id, body: input })}
      />
    </Card>
  );
}
