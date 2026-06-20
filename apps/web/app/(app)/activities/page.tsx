'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { ApiError } from '@/lib/api/client';
import { useActivities, useCompleteActivity, useCreateActivity } from '@/lib/api/hooks';
import type { ActivityType } from '@/lib/api/activities';

const TYPE_COLORS: Record<ActivityType, string> = {
  call: 'blue',
  meeting: 'grape',
  task: 'orange',
  email: 'teal',
};

export default function ActivitiesPage() {
  const { data: items = [], isLoading } = useActivities();
  const complete = useCompleteActivity();
  const create = useCreateActivity();

  const [opened, ctl] = useDisclosure(false);
  const [type, setType] = useState<ActivityType>('task');
  const [subject, setSubject] = useState('');
  const [dueAt, setDueAt] = useState('');

  const submit = () => {
    if (!subject.trim()) {
      notifications.show({ message: 'Subject is required', color: 'red' });
      return;
    }
    create.mutate(
      { type, subject: subject.trim(), dueAt: dueAt || undefined },
      {
        onSuccess: () => {
          notifications.show({ message: 'Activity created', color: 'green' });
          setSubject('');
          setDueAt('');
          ctl.close();
        },
        onError: (e) => notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
      },
    );
  };

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
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <Checkbox
                  checked={a.done}
                  onChange={() => {
                    if (!a.done) complete.mutate(a.id);
                  }}
                  aria-label="Mark done"
                />
                <div>
                  <Text fw={500} td={a.done ? 'line-through' : undefined} c={a.done ? 'dimmed' : undefined}>
                    {a.subject}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Due {a.dueAt?.slice(0, 10) ?? '—'}
                  </Text>
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

      <Modal opened={opened} onClose={ctl.close} title="New activity">
        <Stack>
          <Select
            label="Type"
            data={['call', 'meeting', 'task', 'email']}
            value={type}
            onChange={(v) => setType((v as ActivityType) ?? 'task')}
            allowDeselect={false}
          />
          <TextInput label="Subject" required value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
          <TextInput label="Due date" type="date" value={dueAt} onChange={(e) => setDueAt(e.currentTarget.value)} />
          <Button onClick={submit} loading={create.isPending}>
            Create activity
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
