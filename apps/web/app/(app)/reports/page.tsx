'use client';

import { BarChart, LineChart } from '@mantine/charts';
import { Card, Group, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';
import { Money } from '@/components/primitives/Money';
import { deals, pipelines, stages } from '@/lib/mock/data';

const PIPELINE_ID = 'pl_new';

// Pipeline value by stage (in dollars for the chart axis).
const byStage = stages
  .filter((s) => s.pipelineId === PIPELINE_ID)
  .map((s) => ({
    stage: s.name,
    value: deals.filter((d) => d.stageId === s.id).reduce((a, d) => a + d.value, 0) / 100,
  }));

// Won/Lost over time (mock).
const wonLost = [
  { month: 'Mar', Won: 42000, Lost: 9000 },
  { month: 'Apr', Won: 51000, Lost: 12000 },
  { month: 'May', Won: 38000, Lost: 7000 },
  { month: 'Jun', Won: 60000, Lost: 11000 },
];

export default function ReportsPage() {
  const openValue = deals.filter((d) => d.status === 'open').reduce((a, d) => a + d.value, 0);
  const weighted = deals
    .filter((d) => d.status === 'open')
    .reduce((a, d) => {
      const prob = stages.find((s) => s.id === d.stageId)?.probability ?? 0;
      return a + (d.value * prob) / 100;
    }, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Pipeline health by stage, value and outcome"
        actions={
          <Group>
            <Select
              data={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              defaultValue={PIPELINE_ID}
              allowDeselect={false}
              w={170}
            />
            <Select data={['This quarter', 'This month', 'This year']} defaultValue="This quarter" w={150} />
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Open pipeline
          </Text>
          <Text fz={28} fw={700} mt={4}>
            <Money value={openValue} />
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Weighted forecast
          </Text>
          <Text fz={28} fw={700} mt={4}>
            <Money value={Math.round(weighted)} />
          </Text>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed">
            Open deals
          </Text>
          <Text fz={28} fw={700} mt={4}>
            {deals.filter((d) => d.status === 'open').length}
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" padding="lg">
          <Text fw={600} mb="md">
            Pipeline value by stage
          </Text>
          <BarChart
            h={280}
            data={byStage}
            dataKey="stage"
            series={[{ name: 'value', label: 'Value ($)', color: 'indigo.6' }]}
            valueFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
        </Card>
        <Card withBorder radius="md" padding="lg">
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
            valueFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
        </Card>
      </SimpleGrid>
    </>
  );
}
