'use client';

import { Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Money } from '@/components/primitives/Money';
import { invoices, subscription } from '@/lib/mock/admin';

export default function BillingPage() {
  const monthly = subscription.seats * subscription.pricePerSeat;

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Plan
          </Text>
          <Group gap="xs" mt={4}>
            <Text fw={600}>Per seat</Text>
            <Badge color="yellow" variant="light">
              {subscription.status}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Trial ends {subscription.trialEndsAt}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Seats
          </Text>
          <Text fz={28} fw={700} mt={4}>
            {subscription.seats}
          </Text>
          <Text size="xs" c="dimmed">
            <Money value={subscription.pricePerSeat} /> / seat / mo
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Next invoice
          </Text>
          <Text fz={28} fw={700} mt={4}>
            <Money value={monthly} />
          </Text>
        </Card>
      </SimpleGrid>

      <Group>
        <Button onClick={() => notifications.show({ message: 'Would open Stripe Checkout' })}>
          Add payment method
        </Button>
        <Button variant="default" onClick={() => notifications.show({ message: 'Would open Stripe Portal' })}>
          Manage billing
        </Button>
      </Group>

      <div>
        <Text fw={600} mb="xs">
          Invoices
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td>{i.date}</Table.Td>
                <Table.Td>
                  <Money value={i.amount} />
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={i.status === 'paid' ? 'green' : 'blue'}>
                    {i.status}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </Stack>
  );
}
