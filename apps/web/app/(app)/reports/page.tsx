'use client';

import { BarChart, LineChart } from '@mantine/charts';
import { Card, Center, Loader, SimpleGrid, Text } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';
import { Money } from '@/components/primitives/Money';
import { useByRep, usePipelineReport, useWonLost } from '@/lib/api/hooks';

const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

export default function ReportsPage() {
  const { data: pipeline, isLoading } = usePipelineReport();
  const { data: reps = [] } = useByRep();
  const { data: wl = [] } = useWonLost();

  if (isLoading || !pipeline) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  const byStage = pipeline.byStage.map((s) => ({ stage: s.stageName, value: s.totalValue / 100 }));
  const byRep = reps.map((r) => ({ rep: r.name, value: r.openValue / 100 }));
  const wonLost = wl.map((w) => ({ month: w.period, Won: w.won / 100, Lost: w.lost / 100 }));

  return (
    <>
      <PageHeader title="Reports" subtitle="Pipeline health by stage, rep and outcome" />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Open pipeline
          </Text>
          <Text fz={28} fw={700} mt={4}>
            <Money value={pipeline.kpis.openValue} />
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Weighted forecast
          </Text>
          <Text fz={28} fw={700} mt={4}>
            <Money value={pipeline.kpis.weightedValue} />
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Open deals
          </Text>
          <Text fz={28} fw={700} mt={4}>
            {pipeline.kpis.openDeals}
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" padding="lg">
          <Text fw={600} mb="md">
            Pipeline value by stage
          </Text>
          {byStage.length ? (
            <BarChart
              h={280}
              data={byStage}
              dataKey="stage"
              series={[{ name: 'value', label: 'Open value', color: 'candango.6' }]}
              valueFormatter={usd}
            />
          ) : (
            <Text c="dimmed">No open deals yet.</Text>
          )}
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Text fw={600} mb="md">
            Open value by sales rep
          </Text>
          {byRep.length ? (
            <BarChart
              h={280}
              data={byRep}
              dataKey="rep"
              series={[{ name: 'value', label: 'Open value', color: 'candango.6' }]}
              valueFormatter={usd}
            />
          ) : (
            <Text c="dimmed">No deals yet.</Text>
          )}
        </Card>

        <Card withBorder radius="md" padding="lg" style={{ gridColumn: '1 / -1' }}>
          <Text fw={600} mb="md">
            Won / Lost over time
          </Text>
          <LineChart
            h={280}
            data={wonLost}
            dataKey="month"
            series={[
              { name: 'Won', color: 'teal.6' },
              { name: 'Lost', color: 'red.6' },
            ]}
            valueFormatter={usd}
          />
        </Card>
      </SimpleGrid>
    </>
  );
}
