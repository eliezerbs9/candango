import { Group, Stack, Text, Title } from '@mantine/core';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
      <Stack gap={2}>
        <Title order={2}>{title}</Title>
        {subtitle ? (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {actions}
    </Group>
  );
}
