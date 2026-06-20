'use client';

import { Badge, Card, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { useRoles } from '@/lib/api/hooks';

export default function RolesPage() {
  const { data: roles = [], isLoading } = useRoles();

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack>
      <Text c="dimmed" size="sm">
        Roles in this workspace. Custom roles (editable scope matrix) come later.
      </Text>
      {roles.map((r) => (
        <Card key={r.id} withBorder radius="md" padding="md">
          <Group justify="space-between" mb="xs">
            <Text fw={600}>{r.name}</Text>
            <Badge variant="light">visibility: {r.visibility}</Badge>
          </Group>
          <Group gap={6}>
            {r.scopes.map((s) => (
              <Badge key={s} variant="outline" color="gray" tt="none">
                {s}
              </Badge>
            ))}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
