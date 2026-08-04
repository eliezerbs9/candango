'use client';

import { Badge, Card, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconReceipt2, IconTruckDelivery } from '@tabler/icons-react';
import { AddressFields } from '@/components/deals/AddressFields';
import { QuickbooksPanel } from '@/components/deals/quickbooks/QuickbooksPanel';
import { useDealCtx } from '@/components/deals/DealContext';
import { useQuickbooksStatus } from '@/lib/api/hooks';

export default function DealEstimatesPage() {
  const { deal, form, setForm, saveBar } = useDealCtx();
  const { data: qb } = useQuickbooksStatus();

  return (
    <Stack gap="lg">
      {qb?.connected && (
        <Card withBorder radius="md" padding="lg">
          <Group justify="space-between" mb="md">
            <Text fw={600}>Addresses</Text>
            <Badge size="xs" variant="light" color="blue" style={{ textTransform: 'none' }}>
              QuickBooks
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="sm" wrap="nowrap">
                <ThemeIcon variant="light" color="teal" radius="md" size="lg">
                  <IconTruckDelivery size={18} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="sm">
                    Ship to
                  </Text>
                  <Text size="xs" c="dimmed">
                    Where the work happens
                  </Text>
                </div>
              </Group>
              <AddressFields hideLabel label="Ship to" value={form.shipTo} onChange={(v) => setForm({ ...form, shipTo: v })} />
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Group gap="sm" mb="sm" wrap="nowrap">
                <ThemeIcon variant="light" color="orange" radius="md" size="lg">
                  <IconReceipt2 size={18} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="sm">
                    Bill to
                  </Text>
                  <Text size="xs" c="dimmed">
                    Who pays the invoice
                  </Text>
                </div>
              </Group>
              <AddressFields hideLabel label="Bill to" value={form.billTo} onChange={(v) => setForm({ ...form, billTo: v })} />
            </Paper>
          </SimpleGrid>
          {saveBar}
        </Card>
      )}
      <QuickbooksPanel deal={deal} />
    </Stack>
  );
}
