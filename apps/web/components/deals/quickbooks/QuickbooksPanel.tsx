'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, Divider, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCurrencyDollar, IconFileInvoice, IconInfoCircle, IconPlus, IconReceipt } from '@tabler/icons-react';
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
import { ApiError } from '@/lib/api/client';
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

const openPrint = (kind: 'estimate' | 'invoice', doc: DealDoc) =>
  window.open(`/print/${kind}/${doc.dealId}/${doc.id}`, '_blank');

export function QuickbooksPanel({ deal }: { deal: ApiDeal }) {
  const { data: qb } = useQuickbooksStatus();
  const [linkOpen, linkCtl] = useDisclosure(false);
  const [estOpen, estCtl] = useDisclosure(false);
  const [invOpen, invCtl] = useDisclosure(false);
  const [convertOpen, convertCtl] = useDisclosure(false);

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
  const includeInValue = useIncludeEstimatesInValue(deal.id);
  const includeInvoices = useIncludeInvoicesInValue(deal.id);

  const [estEditing, setEstEditing] = useState<DealDoc | null>(null);
  const [invEditing, setInvEditing] = useState<DealDoc | null>(null);
  const [view, setView] = useState<{ doc: DealDoc; kind: 'Estimate' | 'Invoice' } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendTarget, setSendTarget] = useState<{ doc: DealDoc; kind: 'estimate' | 'invoice' } | null>(null);
  const [stageOpen, stageCtl] = useDisclosure(false);

  const itemList = mode === 'qbo' ? items.data : undefined;
  const estimateDocs = estimates.data ?? [];
  const selectedEstimates = estimateDocs.filter((e) => selected.has(e.id));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openNewEstimate = () => {
    setEstEditing(null);
    estCtl.open();
  };
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

  const submitEstimate = (input: CreateDocInput) =>
    estEditing ? updateEstimate.mutateAsync({ id: estEditing.id, body: input }) : createEstimate.mutateAsync(input);

  const setInValue = (ids: string[], include: boolean) =>
    includeInValue.mutate(
      { estimateIds: ids, include },
      {
        onSuccess: () =>
          notifications.show({ message: include ? 'Added to deal value' : 'Removed from deal value', color: 'green' }),
        onError: fail,
      },
    );

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

        {/* Estimates — always available (native when QuickBooks is not connected) */}
        <Group justify="space-between">
          <Text fw={500}>Estimates</Text>
          <Group gap="xs">
            {canSelect && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconCurrencyDollar size={14} />}
                disabled={selected.size === 0}
                loading={includeInValue.isPending}
                onClick={() => setInValue([...selected], true)}
              >
                Use as deal value{selected.size ? ` (${selected.size})` : ''}
              </Button>
            )}
            {mode === 'qbo' && (
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<IconReceipt size={14} />}
                disabled={selected.size === 0}
                onClick={convertCtl.open}
              >
                Convert to invoice{selected.size ? ` (${selected.size})` : ''}
              </Button>
            )}
            {mode !== 'link' && (
              <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={openNewEstimate}>
                New estimate
              </Button>
            )}
          </Group>
        </Group>
        <DocList
          docs={estimateDocs}
          statuses={ESTIMATE_STATUSES}
          onSetStatus={(id, status) => setEstStatus.mutate({ id, status }, { onError: fail })}
          onToggleInValue={(id, include) => setInValue([id], include)}
          onPrint={(doc) => openPrint('estimate', doc)}
          onSend={mode === 'qbo' ? (doc) => setSendTarget({ doc, kind: 'estimate' }) : undefined}
          onOpen={(doc) => setView({ doc, kind: 'Estimate' })}
          selectedIds={canSelect ? selected : undefined}
          onToggleSelect={canSelect ? toggleSelect : undefined}
          emptyText={mode === 'link' ? 'Link the deal to add estimates.' : 'No estimates yet.'}
        />

        {/* Invoices — only when connected; created only by converting estimates; always in the deal value */}
        {mode === 'qbo' && (
          <>
            <Divider />
            <Group justify="space-between">
              <Text fw={500}>Invoices</Text>
              <Text size="xs" c="dimmed">
                Always counted in the deal value
              </Text>
            </Group>
            <DocList
              docs={invoices.data ?? []}
              statuses={INVOICE_STATUSES}
              onSetStatus={(id, status) =>
                setInvStatus.mutate({ id, status }, { onSuccess: () => stageCtl.open(), onError: fail })
              }
              onToggleInValue={(id, include) => includeInvoices.mutate({ invoiceIds: [id], include }, { onError: fail })}
              onPrint={(doc) => openPrint('invoice', doc)}
              onSend={(doc) => setSendTarget({ doc, kind: 'invoice' })}
              onOpen={(doc) => setView({ doc, kind: 'Invoice' })}
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
        estimates={selectedEstimates}
        currency={deal.currency}
        opened={convertOpen}
        onClose={convertCtl.close}
        onConverted={() => setSelected(new Set())}
      />

      <DocViewModal
        doc={view?.doc ?? null}
        kind={view?.kind ?? 'Estimate'}
        opened={!!view}
        onClose={() => setView(null)}
        onEdit={editFromView}
      />

      <SendDocModal
        dealId={deal.id}
        doc={sendTarget?.doc ?? null}
        kind={sendTarget?.kind ?? 'estimate'}
        opened={!!sendTarget}
        onClose={() => setSendTarget(null)}
        onSent={() => {
          if (sendTarget?.kind === 'invoice') stageCtl.open();
        }}
      />

      <MoveStageModal
        dealId={deal.id}
        pipelineId={deal.pipelineId}
        currentStageId={deal.stageId}
        opened={stageOpen}
        onClose={stageCtl.close}
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
