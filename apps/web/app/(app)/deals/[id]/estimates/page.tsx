'use client';

import { Badge, Card, Grid, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconReceipt2, IconTruckDelivery } from '@tabler/icons-react';
import { AddressPicker } from '@/components/deals/AddressPicker';
import { SaveStatus } from '@/components/proposals/SaveStatus';
import { QuickbooksPanel } from '@/components/deals/quickbooks/QuickbooksPanel';
import { useDealCtx } from '@/components/deals/DealContext';
import { useCompanies, useQuickbooksStatus } from '@/lib/api/hooks';
import { useAutosave } from '@/lib/useAutosave';

export default function DealEstimatesPage() {
  const { deal, form, setForm, save } = useDealCtx();
  const { data: qb } = useQuickbooksStatus();
  const { data: companies = [] } = useCompanies();

  const c = companies.find((x) => x.id === form.companyId);
  const company = c ? { id: c.id, name: c.name, address: c.address ?? {} } : null;

  // Addresses auto-save (no "Save changes" button) — debounced whole-deal save of ship/bill.
  const status = useAutosave({ shipTo: form.shipTo, billTo: form.billTo }, (v) => save(v), true);

  return (
    <Grid gutter="lg">
      {/* Desktop: 3 columns — addresses (stacked) · estimates · invoices. Stacks on small screens. */}
      <Grid.Col span={{ base: 12, lg: 4 }}>
        <Card withBorder radius="md" padding="lg">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <Text fw={600}>Addresses</Text>
              {qb?.connected && (
                <Badge size="xs" variant="light" color="blue" style={{ textTransform: 'none' }}>
                  QuickBooks
                </Badge>
              )}
            </Group>
            <SaveStatus status={status} />
          </Group>
          <Stack gap="md">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="sm" wrap="nowrap">
                <ThemeIcon variant="light" color="teal" radius="md" size="lg">
                  <IconTruckDelivery size={18} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="sm">Ship to</Text>
                  <Text size="xs" c="dimmed">Where the work happens</Text>
                </div>
              </Group>
              <AddressPicker
                label=""
                placeholder="Pick a work site"
                value={form.shipTo}
                onChange={(v) => setForm({ ...form, shipTo: v })}
                dealId={deal.id}
                company={company}
              />
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="sm" wrap="nowrap">
                <ThemeIcon variant="light" color="orange" radius="md" size="lg">
                  <IconReceipt2 size={18} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="sm">Bill to</Text>
                  <Text size="xs" c="dimmed">Who pays the invoice</Text>
                </div>
              </Group>
              <AddressPicker
                label=""
                placeholder="Pick who to bill"
                value={form.billTo}
                onChange={(v) => setForm({ ...form, billTo: v })}
                dealId={deal.id}
                company={company}
              />
            </Paper>
          </Stack>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 8 }}>
        <QuickbooksPanel deal={deal} />
      </Grid.Col>
    </Grid>
  );
}
