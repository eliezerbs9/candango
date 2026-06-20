import { Card, SimpleGrid, Text } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Welcome to Candango" />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {['Open deals', 'Weighted pipeline', 'Won this month'].map((label) => (
          <Card key={label} withBorder radius="md" padding="lg">
            <Text size="sm" c="dimmed">
              {label}
            </Text>
            <Text fz={28} fw={700} mt={4}>
              —
            </Text>
          </Card>
        ))}
      </SimpleGrid>
      <Text c="dimmed" size="sm" mt="xl">
        UI-0 foundation is ready. Real widgets arrive in UI-4 (Reporting).
      </Text>
    </>
  );
}
