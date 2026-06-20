'use client';

import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import { roles } from '@/lib/mock/admin';

export default function RolesPage() {
  return (
    <Stack>
      <Text c="dimmed" size="sm">
        Built-in roles. Custom roles (scope matrix + visibility) arrive when wired to the API.
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
