'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, Divider, Group, Stack, Text } from '@mantine/core';
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
  IconX,
} from '@tabler/icons-react';
import {
  useCreateEstimate,
  useDealEstimates,
  useDealInvoices,
  useIncludeEstimatesInValue,
  useIncludeInvoicesInValue,
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
import type { ApiDeal, CreateDocInput, DealDoc } from '@/lib/api/types';
import { DocList } from './DocList';
import { DocEditorModal } from './DocEditorModal';
import { DocViewModal } from './DocViewModal';
import { LinkAccountModal } from './LinkAccountModal';
import { ConvertToInvoiceModal } from './ConvertToInvoiceModal';
import { SendDocModal } from './SendDocModal';
import { MoveStageModal } from './MoveStageModal';

const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'closed'];
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'];

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

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
  const canSelect = mode !== 'link';

  const estimates = useDealEstimates(deal.id);
  const invoices = useDealInvoices(deal.id);
  const items = useQbItems(deal.id, mode === 'qbo');
  const createEstimate = useCreateEstimate(deal.id);
  const updateEstimate = useUpdateEstimate(deal.id);
  const updateInvoice = useUpdateInvoice(deal.id);
  const setEstStatus = useSetEstimateStatus(deal.id);
  const setInvStatus = useSetInvoiceStatus(deal.id);
  const includeEstimates = useIncludeEstimatesInValue(deal.id);
  const includeInvoices = useIncludeInvoicesInValue(deal.id);

  const [estEditing, setEstEditing] = useState<DealDoc | null>(null);
  const [invEditing, setInvEditing] = useState<DealDoc | null>(null);
  const [view, setView] = useState<{ doc: DealDoc; kind: 'Estimate' | 'Invoice' } | null>(null);
  const [estSel, setEstSel] = useState<Set<string>>(new Set());
  const [invSel, setInvSel] = useState<Set<string>>(new Set());
  const [send, setSend] = useState<{ docs: DealDoc[]; kind: 'estimate' | 'invoice' } | null>(null);

  const itemList = mode === 'qbo' ? items.data : undefined;
  const estimateDocs = estimates.data ?? [];
  const invoiceDocs = invoices.data ?? [];
  const selEstimates = estimateDocs.filter((e) => estSel.has(e.id));
  const selInvoices = invoiceDocs.filter((i) => invSel.has(i.id));

  const toggle = (set: (fn: (p: Set<string>) => Set<string>) => void) => (id: string) =>
    set((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Connected → open the actual QuickBooks PDF; otherwise our own print page.
  const openDoc = async (doc: DealDoc, kind: 'estimate' | 'invoice') => {
    if (connected && doc.qbId) {
      const w = window.open('', '_blank');
      try {
        const blob = await fetchDocPdf(token!, deal.id, kind, doc.id);
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
      await Promise.all(
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
      );
    } else {
      docs.forEach((doc) => window.open(`/print/${kind}/${deal.id}/${doc.id}`, '_blank'));
    }
  };

  const valueToast = (include: boolean) => ({
    onSuccess: () =>
      notifications.show({ message: include ? 'Added to deal value' : 'Removed from deal value', color: 'green' }),
    onError: fail,
  });
  const markEstimates = (ids: string[], include: boolean) =>
    includeEstimates.mutate({ estimateIds: ids, include }, valueToast(include));
  const markInvoices = (ids: string[], include: boolean) =>
    includeInvoices.mutate({ invoiceIds: ids, include }, valueToast(include));

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
        {canSelect && estSel.size > 0 && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">{estSel.size} selected</Text>
            <Button size="xs" variant="light" leftSection={<IconCurrencyDollar size={14} />} onClick={() => markEstimates([...estSel], true)}>
              Use as deal value
            </Button>
            <Button size="xs" variant="light" color="gray" leftSection={<IconX size={14} />} onClick={() => markEstimates([...estSel], false)}>
              Remove from value
            </Button>
            {mode === 'qbo' && (
              <Button size="xs" variant="light" color="teal" leftSection={<IconReceipt size={14} />} onClick={convertCtl.open}>
                Convert to invoice
              </Button>
            )}
            {mode === 'qbo' && (
              <Button size="xs" variant="light" leftSection={<IconSend size={14} />} onClick={() => setSend({ docs: selEstimates, kind: 'estimate' })}>
                Send
              </Button>
            )}
            <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={() => printMany(selEstimates, 'estimate')}>
              Print
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={() => setEstSel(new Set())}>
              Clear
            </Button>
          </Group>
        )}
        <DocList
          docs={estimateDocs}
          statuses={ESTIMATE_STATUSES}
          onSetStatus={(id, status) => setEstStatus.mutate({ id, status }, { onError: fail })}
          onOpen={(doc) => setView({ doc, kind: 'Estimate' })}
          selectedIds={canSelect ? estSel : undefined}
          onToggleSelect={canSelect ? toggle(setEstSel) : undefined}
          emptyText={mode === 'link' ? 'Link the deal to add estimates.' : 'No estimates yet.'}
        />

        {/* Invoices — only when connected; created only by converting estimates */}
        {mode === 'qbo' && (
          <>
            <Divider />
            <Text fw={500}>Invoices</Text>
            {invSel.size > 0 && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">{invSel.size} selected</Text>
                <Button size="xs" variant="light" leftSection={<IconCurrencyDollar size={14} />} onClick={() => markInvoices([...invSel], true)}>
                  Add to deal value
                </Button>
                <Button size="xs" variant="light" color="gray" leftSection={<IconX size={14} />} onClick={() => markInvoices([...invSel], false)}>
                  Remove from value
                </Button>
                <Button size="xs" variant="light" leftSection={<IconSend size={14} />} onClick={() => setSend({ docs: selInvoices, kind: 'invoice' })}>
                  Send
                </Button>
                <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={() => printMany(selInvoices, 'invoice')}>
                  Print
                </Button>
                <Button size="xs" variant="subtle" color="gray" onClick={() => setInvSel(new Set())}>
                  Clear
                </Button>
              </Group>
            )}
            <DocList
              docs={invoiceDocs}
              statuses={INVOICE_STATUSES}
              onSetStatus={(id, status) => setInvStatus.mutate({ id, status }, { onSuccess: () => stageCtl.open(), onError: fail })}
              onOpen={(doc) => setView({ doc, kind: 'Invoice' })}
              selectedIds={invSel}
              onToggleSelect={toggle(setInvSel)}
              emptyText="No invoices yet — select estimate(s) above and convert them."
            />
          </>
        )}

        {mode === 'native' && (
          <Text size="xs" c="dimmed">
            Connect QuickBooks in Settings → Integrations to create invoices.
          </Text>
        )}
      </Stack>

      <LinkAccountModal dealId={deal.id} dealTitle={deal.title} opened={linkOpen} onClose={linkCtl.close} />

      <ConvertToInvoiceModal
        dealId={deal.id}
        estimates={selEstimates}
        currency={deal.currency}
        opened={convertOpen}
        onClose={convertCtl.close}
        onConverted={() => setEstSel(new Set())}
      />

      <SendDocModal
        dealId={deal.id}
        docs={send?.docs ?? []}
        kind={send?.kind ?? 'estimate'}
        opened={!!send}
        onClose={() => setSend(null)}
        onSent={() => {
          if (send?.kind === 'invoice') stageCtl.open();
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
        onEdit={editFromView}
        onPrint={view ? () => openDoc(view.doc, view.kind === 'Invoice' ? 'invoice' : 'estimate') : undefined}
      />

      <DocEditorModal
        opened={estOpen}
        onClose={estCtl.close}
        title={estEditing ? 'Edit estimate' : 'New estimate'}
        submitLabel={estEditing ? 'Save' : 'Create'}
        currency={deal.currency}
        items={itemList}
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
        initial={invEditing}
        loading={updateInvoice.isPending}
        onSubmit={(input) => updateInvoice.mutateAsync({ id: invEditing!.id, body: input })}
      />
    </Card>
  );
}
