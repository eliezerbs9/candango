'use client';

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
  useQuickbooksStatus,
  useSetEstimateStatus,
  useSetInvoiceStatus,
} from '@/lib/api/hooks';
import { ApiError } from '@/lib/api/client';
import type { ApiDeal } from '@/lib/api/types';
import { DocList } from './DocList';
import { DocEditorModal } from './DocEditorModal';
import { LinkAccountModal } from './LinkAccountModal';

const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'closed'];
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'];

export function QuickbooksPanel({ deal }: { deal: ApiDeal }) {
  const { data: qb } = useQuickbooksStatus();
  const [linkOpen, linkCtl] = useDisclosure(false);
  const [estOpen, estCtl] = useDisclosure(false);
  const [invOpen, invCtl] = useDisclosure(false);

  const estimates = useDealEstimates(deal.id);
  const invoices = useDealInvoices(deal.id);
  const createEstimate = useCreateEstimate(deal.id);
  const createInvoice = useCreateInvoice(deal.id);
  const setEstStatus = useSetEstimateStatus(deal.id);
  const setInvStatus = useSetInvoiceStatus(deal.id);
  const useAsValue = useEstimateAsDealValue(deal.id);

  const connected = !!qb?.connected;
  const linked = !!deal.qbSubcustomerId;
  // native = price the deal offline; link = connect this deal to QBO; qbo = full estimates + invoices
  const mode: 'native' | 'link' | 'qbo' = !connected ? 'native' : linked ? 'qbo' : 'link';

  const applyAsValue = (id: string) =>
    useAsValue.mutate(id, {
      onSuccess: () => notifications.show({ message: 'Deal value updated from estimate', color: 'green' }),
      onError: (e) =>
        notifications.show({ message: e instanceof ApiError ? e.message : 'Could not update value', color: 'red' }),
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
            <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={estCtl.open}>
              New estimate
            </Button>
          )}
        </Group>
        <DocList
          docs={estimates.data ?? []}
          statuses={ESTIMATE_STATUSES}
          onSetStatus={(id, status) => setEstStatus.mutate({ id, status })}
          onUseAsValue={applyAsValue}
          emptyText={mode === 'link' ? 'Link the deal to add estimates.' : 'No estimates yet.'}
        />

        {/* Invoices — only when connected to QuickBooks */}
        {mode === 'qbo' && (
          <>
            <Divider />
            <Group justify="space-between">
              <Text fw={500}>Invoices</Text>
              <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={invCtl.open}>
                New invoice
              </Button>
            </Group>
            <DocList
              docs={invoices.data ?? []}
              statuses={INVOICE_STATUSES}
              onSetStatus={(id, status) => setInvStatus.mutate({ id, status })}
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
      <DocEditorModal
        opened={estOpen}
        onClose={estCtl.close}
        title="New estimate"
        currency={deal.currency}
        loading={createEstimate.isPending}
        onSubmit={(input) => createEstimate.mutateAsync(input)}
      />
      <DocEditorModal
        opened={invOpen}
        onClose={invCtl.close}
        title="New invoice"
        currency={deal.currency}
        loading={createInvoice.isPending}
        onSubmit={(input) => createInvoice.mutateAsync(input)}
      />
    </Card>
  );
}
