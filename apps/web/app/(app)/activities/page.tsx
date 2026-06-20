'use client';

import { useState } from 'react';
import { Badge, Button, Checkbox, Group, Paper, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { activities as seed } from '@/lib/mock/data';
import type { Activity, ActivityType } from '@/lib/types';

const TYPE_COLORS: Record<ActivityType, string> = {
  call: 'blue',
  meeting: 'grape',
  task: 'orange',
  email: 'teal',
};

export default function ActivitiesPage() {
  const [items, setItems] = useState<Activity[]>(seed);

  const toggle = (id: string) =>
    setItems((cur) => cur.map((a) => (a.id === id ? { ...a, done: !a.done } : a)));

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Your tasks, calls, meetings and emails"
        actions={<Button leftSection={<IconPlus size={16} />}>New activity</Button>}
      />
      <Stack gap="xs">
        {items.map((a) => (
          <Paper key={a.id} withBorder radius="md" p="sm">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <Checkbox checked={a.done} onChange={() => toggle(a.id)} aria-label="Mark done" />
                <div>
                  <Text fw={500} td={a.done ? 'line-through' : undefined} c={a.done ? 'dimmed' : undefined}>
                    {a.subject}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Due {a.dueAt ?? '—'}
                  </Text>
                </div>
              </Group>
              <Badge color={TYPE_COLORS[a.type]} variant="light" tt="capitalize">
                {a.type}
              </Badge>
            </Group>
          </Paper>
        ))}
      </Stack>
    </>
  );
}
