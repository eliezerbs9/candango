'use client';

import { Alert, Badge, Button, Card, Divider, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconFileInvoice, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import {
  useCreateEstimate,
  useCreateInvoice,
  useDealEstimates,
  useDealInvoices,
  useQuickbooksStatus,
  useSetEstimateStatus,
  useSetInvoiceStatus,
} from '@/lib/api/hooks';
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

  const connected = qb?.connected;
  const linked = !!deal.qbSubcustomerId;

  const header = (
    <Group justify="space-between">
      <Group gap="xs">
        <IconFileInvoice size={18} />
        <Text fw={600}>Billing</Text>
        {connected && <Badge size="xs" color="teal" variant="light">QuickBooks</Badge>}
      </Group>
      {connected && !linked && (
        <Button size="xs" variant="light" onClick={linkCtl.open}>
          Set up QuickBooks billing
        </Button>
      )}
    </Group>
  );

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        {header}

        {!connected && (
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />}>
            Connect QuickBooks in Settings → Integrations to create estimates and invoices for this deal.
          </Alert>
        )}

        {connected && !linked && (
          <Text size="sm" c="dimmed">
            Link this deal to a QuickBooks account to start creating estimates and invoices.
          </Text>
        )}

        {connected && linked && (
          <>
            {/* Estimates */}
            <Group justify="space-between">
              <Text fw={500}>Estimates</Text>
              <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={estCtl.open}>
                New estimate
              </Button>
            </Group>
            <DocList
              docs={estimates.data ?? []}
              statuses={ESTIMATE_STATUSES}
              onSetStatus={(id, status) => setEstStatus.mutate({ id, status })}
              emptyText="No estimates yet."
            />

            <Divider />

            {/* Invoices */}
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
