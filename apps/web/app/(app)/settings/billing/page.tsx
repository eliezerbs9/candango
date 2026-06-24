'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Anchor, Badge, Button, Card, Center, Group, Loader, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { IconAlertTriangle, IconExternalLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Money } from '@/components/primitives/Money';
import { ApiError } from '@/lib/api/client';
import { useBilling, useCheckout, usePortal } from '@/lib/api/hooks';

const STATUS_COLOR: Record<string, string> = {
  trialing: 'blue',
  active: 'teal',
  past_due: 'red',
  canceled: 'gray',
  locked: 'red',
};

export default function BillingPage() {
  const { data: b, isLoading } = useBilling();
  const checkout = useCheckout();
  const portal = usePortal();
  const params = useSearchParams();

  useEffect(() => {
    const c = params.get('checkout');
    if (c === 'success') notifications.show({ message: 'Subscription updated — thank you!', color: 'green' });
    if (c === 'cancel') notifications.show({ message: 'Checkout canceled', color: 'yellow' });
  }, [params]);

  const go = (m: typeof checkout | typeof portal) =>
    m.mutate(undefined, {
      onSuccess: ({ url }) => {
        if (url) window.location.href = url;
      },
      onError: (e) =>
        notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' }),
    });

  if (isLoading || !b) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      {b.locked && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title="Workspace locked">
          Your trial ended without an active subscription. Add a payment method to restore full access.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Plan
          </Text>
          <Group gap="xs" mt={4}>
            <Text fw={600}>Per seat</Text>
            <Badge color={STATUS_COLOR[b.status] ?? 'gray'} variant="light" tt="capitalize">
              {b.status}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {b.status === 'trialing'
              ? `Trial ends in ${b.trialDaysLeft} day${b.trialDaysLeft === 1 ? '' : 's'}`
              : b.currentPeriodEnd
                ? `Renews ${new Date(b.currentPeriodEnd).toLocaleDateString()}`
                : '—'}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Active seats
          </Text>
          <Text fz={28} fw={700} mt={4}>
            {b.seats}
          </Text>
          <Text size="xs" c="dimmed">
            <Money value={b.pricePerSeat} currency={b.currency} /> / seat / mo
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            {b.status === 'active' ? 'Next invoice' : 'Estimated monthly'}
          </Text>
          <Text fz={28} fw={700} mt={4}>
            <Money value={b.monthlyTotal} currency={b.currency} />
          </Text>
        </Card>
      </SimpleGrid>

      <Group>
        {b.hasSubscription ? (
          <>
            <Button variant="default" loading={portal.isPending} onClick={() => go(portal)}>
              Manage billing
            </Button>
            <Button variant="subtle" loading={checkout.isPending} onClick={() => go(checkout)}>
              Update subscription
            </Button>
          </>
        ) : (
          <Button loading={checkout.isPending} onClick={() => go(checkout)}>
            Add payment method
          </Button>
        )}
      </Group>

      <div>
        <Text fw={600} mb="xs">
          Invoices
        </Text>
        {b.invoices.length === 0 ? (
          <Text size="sm" c="dimmed">
            No invoices yet.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {b.invoices.map((i) => (
                <Table.Tr key={i.id}>
                  <Table.Td>{new Date(i.createdAt).toLocaleDateString()}</Table.Td>
                  <Table.Td>
                    <Money value={i.amountPaid || i.amountDue} currency={i.currency} />
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={i.status === 'paid' ? 'teal' : i.status === 'open' ? 'blue' : 'gray'}
                      tt="capitalize"
                    >
                      {i.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {i.hostedInvoiceUrl && (
                      <Anchor href={i.hostedInvoiceUrl} target="_blank" size="sm">
                        <Group gap={4}>
                          View <IconExternalLink size={13} />
                        </Group>
                      </Anchor>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>
    </Stack>
  );
}
