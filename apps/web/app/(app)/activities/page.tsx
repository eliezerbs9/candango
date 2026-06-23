'use client';

import { Badge, Button, Center, Checkbox, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMapPin, IconPlus, IconVideo } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { ActivityForm } from '@/components/activities/ActivityForm';
import { useActivities, useCompleteActivity } from '@/lib/api/hooks';
import type { ActivityType, ApiActivity } from '@/lib/api/activities';

const TYPE_COLORS: Record<ActivityType, string> = {
  call: 'blue',
  meeting: 'grape',
  task: 'orange',
  email: 'teal',
};

function whenLabel(a: ApiActivity) {
  if (a.startAt) {
    const d = new Date(a.startAt);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  if (a.dueAt) return `Due ${a.dueAt.slice(0, 10)}`;
  return '—';
}

export default function ActivitiesPage() {
  const { data: items = [], isLoading } = useActivities();
  const complete = useCompleteActivity();
  const [opened, ctl] = useDisclosure(false);

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Your tasks, calls, meetings and emails"
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={ctl.open}>
            New activity
          </Button>
        }
      />

      <Stack gap="xs">
        {items.map((a) => (
          <Paper key={a.id} withBorder radius="md" p="sm">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <Checkbox
                  checked={a.done}
                  onChange={() => {
                    if (!a.done) complete.mutate(a.id);
                  }}
                  aria-label="Mark done"
                  mt={2}
                />
                <div>
                  <Text fw={500} td={a.done ? 'line-through' : undefined} c={a.done ? 'dimmed' : undefined}>
                    {a.subject}
                  </Text>
                  <Group gap={8} mt={2}>
                    <Text size="xs" c="dimmed">
                      {whenLabel(a)}
                    </Text>
                    {a.locationType === 'in_person' && a.location ? (
                      <Text size="xs" c="dimmed">
                        <IconMapPin size={11} style={{ verticalAlign: -1 }} /> {a.location}
                      </Text>
                    ) : null}
                    {a.locationType === 'video' && a.conferenceUrl ? (
                      <Text size="xs" c="blue" component="a" href={a.conferenceUrl} target="_blank">
                        <IconVideo size={11} style={{ verticalAlign: -1 }} /> Join
                      </Text>
                    ) : null}
                  </Group>
                  {a.participants.length ? (
                    <Text size="xs" c="dimmed" mt={2}>
                      With {a.participants.map((p) => p.name).join(', ')}
                    </Text>
                  ) : null}
                </div>
              </Group>
              <Badge color={TYPE_COLORS[a.type]} variant="light" tt="capitalize">
                {a.type}
              </Badge>
            </Group>
          </Paper>
        ))}
        {items.length === 0 ? <Text c="dimmed">No activities yet.</Text> : null}
      </Stack>

      <ActivityForm opened={opened} onClose={ctl.close} />
    </>
  );
}
