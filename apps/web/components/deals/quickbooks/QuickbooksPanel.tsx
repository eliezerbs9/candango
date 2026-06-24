'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, Divider, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconFileInvoice, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import {
  useCreateEstimate,
  useCreateInvoice,
  useDealEstimates,
  useDealInvoices,
  useEstimateAsDealValue,
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

const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'closed'];
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'];

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export function QuickbooksPanel({ deal }: { deal: ApiDeal }) {
  const { data: qb } = useQuickbooksStatus();
  const [linkOpen, linkCtl] = useDisclosure(false);
  const [estOpen, estCtl] = useDisclosure(false);
  const [invOpen, invCtl] = useDisclosure(false);

  const connected = !!qb?.connected;
  const linked = !!deal.qbSubcustomerId;
  const mode: 'native' | 'link' | 'qbo' = !connected ? 'native' : linked ? 'qbo' : 'link';

  const estimates = useDealEstimates(deal.id);
  const invoices = useDealInvoices(deal.id);
  const items = useQbItems(deal.id, mode === 'qbo');
  const createEstimate = useCreateEstimate(deal.id);
  const updateEstimate = useUpdateEstimate(deal.id);
  const createInvoice = useCreateInvoice(deal.id);
  const updateInvoice = useUpdateInvoice(deal.id);
  const setEstStatus = useSetEstimateStatus(deal.id);
  const setInvStatus = useSetInvoiceStatus(deal.id);
  const useAsValue = useEstimateAsDealValue(deal.id);

  // null = creating, a doc = editing
  const [estEditing, setEstEditing] = useState<DealDoc | null>(null);
  const [invEditing, setInvEditing] = useState<DealDoc | null>(null);
  const [view, setView] = useState<{ doc: DealDoc; kind: 'Estimate' | 'Invoice' } | null>(null);

  const itemList = mode === 'qbo' ? items.data : undefined;

  const openNewEstimate = () => {
    setEstEditing(null);
    estCtl.open();
  };
  const openNewInvoice = () => {
    setInvEditing(null);
    invCtl.open();
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
  const submitInvoice = (input: CreateDocInput) =>
    invEditing ? updateInvoice.mutateAsync({ id: invEditing.id, body: input }) : createInvoice.mutateAsync(input);

  const applyAsValue = (id: string) =>
    useAsValue.mutate(id, {
      onSuccess: () => notifications.show({ message: 'Deal value updated from estimate', color: 'green' }),
      onError: fail,
    });

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
          {mode !== 'link' && (
            <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={openNewEstimate}>
              New estimate
            </Button>
          )}
        </Group>
        <DocList
          docs={estimates.data ?? []}
          statuses={ESTIMATE_STATUSES}
          onSetStatus={(id, status) => setEstStatus.mutate({ id, status }, { onError: fail })}
          onUseAsValue={applyAsValue}
          onOpen={(doc) => setView({ doc, kind: 'Estimate' })}
          emptyText={mode === 'link' ? 'Link the deal to add estimates.' : 'No estimates yet.'}
        />

        {/* Invoices — only when connected to QuickBooks */}
        {mode === 'qbo' && (
          <>
            <Divider />
            <Group justify="space-between">
              <Text fw={500}>Invoices</Text>
              <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={openNewInvoice}>
                New invoice
              </Button>
            </Group>
            <DocList
              docs={invoices.data ?? []}
              statuses={INVOICE_STATUSES}
              onSetStatus={(id, status) => setInvStatus.mutate({ id, status }, { onError: fail })}
              onOpen={(doc) => setView({ doc, kind: 'Invoice' })}
              emptyText="No invoices yet."
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

      <DocViewModal
        doc={view?.doc ?? null}
        kind={view?.kind ?? 'Estimate'}
        opened={!!view}
        onClose={() => setView(null)}
        onEdit={editFromView}
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
        title={invEditing ? 'Edit invoice' : 'New invoice'}
        submitLabel={invEditing ? 'Save' : 'Create'}
        currency={deal.currency}
        items={itemList}
        initial={invEditing}
        loading={createInvoice.isPending || updateInvoice.isPending}
        onSubmit={submitInvoice}
      />
    </Card>
  );
}
