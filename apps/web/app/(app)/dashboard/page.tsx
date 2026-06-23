'use client';

import Link from 'next/link';
import { Anchor, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';
import { Money } from '@/components/primitives/Money';
import { useAllStages, useDeals, usePipelineReport, useWonLost } from '@/lib/api/hooks';

export default function DashboardPage() {
  const { data: report } = usePipelineReport();
  const { data: wonLost = [] } = useWonLost();
  const { data: openDeals = [], isLoading: loadingDeals } = useDeals({ status: 'open' });
  const { data: stages = [] } = useAllStages();

  const wonThisMonth = wonLost.length ? wonLost[wonLost.length - 1].won : 0;
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? '—';

  const cards: { label: string; node: React.ReactNode }[] = [
    { label: 'Open deals', node: report?.kpis.openDeals ?? 0 },
    { label: 'Weighted pipeline', node: <Money value={report?.kpis.weightedValue ?? 0} /> },
    { label: 'Won this month', node: <Money value={wonThisMonth} /> },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Welcome to Candango" />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {cards.map((c) => (
          <Card key={c.label} withBorder radius="md" padding="lg">
            <Text size="sm" c="dimmed">
              {c.label}
            </Text>
            <Text fz={28} fw={700} mt={4}>
              {c.node}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder radius="md" padding="lg" mt="lg">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Open deals</Text>
          <Anchor component={Link} href="/deals" size="sm">
            View all
          </Anchor>
        </Group>

        {loadingDeals ? (
          <Text c="dimmed" size="sm">
            Loading…
          </Text>
        ) : openDeals.length === 0 ? (
          <Text c="dimmed" size="sm">
            No open deals yet. Create one from the Pipelines or Deals page.
          </Text>
        ) : (
          <Stack gap="xs">
            {openDeals.slice(0, 8).map((d) => (
              <Group key={d.id} justify="space-between" wrap="nowrap">
                <Text size="sm" truncate>
                  {d.title}
                </Text>
                <Group gap="md" wrap="nowrap">
                  <Text size="xs" c="dimmed">
                    {stageName(d.stageId)}
                  </Text>
                  <Text size="sm" fw={500}>
                    <Money value={d.value} />
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Card>
    </>
  );
}
