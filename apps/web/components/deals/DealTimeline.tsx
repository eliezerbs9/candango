'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Group, Paper, Stack, Text, Textarea, ThemeIcon, Timeline } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconCalendarEvent,
  IconMail,
  IconNote,
  IconPhone,
  IconChecklist,
  IconPlus,
} from '@tabler/icons-react';
import { ActivityForm } from '@/components/activities/ActivityForm';
import { ApiError } from '@/lib/api/client';
import {
  useActivities,
  useCreateNote,
  useDealMessages,
  useNotes,
  useStageHistory,
} from '@/lib/api/hooks';
import type { ApiActivity } from '@/lib/api/activities';
import type { ApiNote } from '@/lib/api/notes';
import type { ApiMessage } from '@/lib/api/messages';
import type { StageEvent } from '@/lib/api/deals';

type Item =
  | { kind: 'note'; date: Date; data: ApiNote }
  | { kind: 'activity'; date: Date; data: ApiActivity }
  | { kind: 'message'; date: Date; data: ApiMessage }
  | { kind: 'stage'; date: Date; data: StageEvent };

const fmt = (d: Date) => d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function DealTimeline({ dealId }: { dealId: string }) {
  const { data: activities = [] } = useActivities({ dealId });
  const { data: notes = [] } = useNotes(dealId);
  const { data: messages = [] } = useDealMessages(dealId);
  const { data: stages = [] } = useStageHistory(dealId);
  const createNote = useCreateNote();

  const [noteBody, setNoteBody] = useState('');
  const [actOpen, actCtl] = useDisclosure(false);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    notes.forEach((n) => out.push({ kind: 'note', date: new Date(n.createdAt), data: n }));
    activities.forEach((a) =>
      out.push({ kind: 'activity', date: new Date(a.startAt ?? a.dueAt ?? a.createdAt), data: a }),
    );
    messages.forEach((m) => out.push({ kind: 'message', date: new Date(m.sentAt ?? m.createdAt), data: m }));
    stages.forEach((s) => out.push({ kind: 'stage', date: new Date(s.createdAt), data: s }));
    return out.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [activities, notes, messages, stages]);

  const addNote = () => {
    if (!noteBody.trim()) return;
    createNote.mutate(
      { dealId, body: noteBody.trim() },
      {
        onSuccess: () => {
          setNoteBody('');
          notifications.show({ message: 'Note added', color: 'green' });
        },
        onError: (e) =>
          notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
      },
    );
  };

  return (
    <Stack gap="md">
      {/* Composer */}
      <Paper withBorder radius="md" p="sm">
        <Textarea
          placeholder="Add a note…"
          autosize
          minRows={2}
          value={noteBody}
          onChange={(e) => setNoteBody(e.currentTarget.value)}
        />
        <Group justify="space-between" mt="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={actCtl.open}
          >
            Log activity
          </Button>
          <Button size="xs" onClick={addNote} loading={createNote.isPending} disabled={!noteBody.trim()}>
            Add note
          </Button>
        </Group>
      </Paper>

      {items.length === 0 ? (
        <Text c="dimmed" size="sm">
          No history yet. Add a note or log an activity.
        </Text>
      ) : (
        <Timeline active={-1} bulletSize={26} lineWidth={2}>
          {items.map((it) => (
            <Timeline.Item key={`${it.kind}-${itemKey(it)}`} bullet={bullet(it)} title={titleOf(it)}>
              <Text size="xs" c="dimmed">
                {fmt(it.date)}
              </Text>
              {bodyOf(it)}
            </Timeline.Item>
          ))}
        </Timeline>
      )}

      <ActivityForm opened={actOpen} onClose={actCtl.close} defaultDealId={dealId} />
    </Stack>
  );
}

function itemKey(it: Item): string {
  return 'id' in it.data ? it.data.id : String(it.date.getTime());
}

function bullet(it: Item) {
  const map = {
    note: <IconNote size={14} />,
    message: <IconMail size={14} />,
    stage: <IconArrowRight size={14} />,
    activity: <IconChecklist size={14} />,
  } as const;
  const color = { note: 'gray', message: 'teal', stage: 'indigo', activity: 'blue' } as const;
  let icon: React.ReactNode = map[it.kind];
  if (it.kind === 'activity') {
    icon = it.data.type === 'meeting' ? <IconCalendarEvent size={14} /> : it.data.type === 'call' ? <IconPhone size={14} /> : <IconChecklist size={14} />;
  }
  return (
    <ThemeIcon size={26} radius="xl" variant="light" color={color[it.kind]}>
      {icon}
    </ThemeIcon>
  );
}

function titleOf(it: Item): React.ReactNode {
  switch (it.kind) {
    case 'note':
      return <Text fw={500} size="sm">Note · {it.data.authorName}</Text>;
    case 'message':
      return (
        <Group gap={6}>
          <Text fw={500} size="sm">{it.data.subject || '(no subject)'}</Text>
          <Badge size="xs" variant="light" color={it.data.direction === 'out' ? 'blue' : 'teal'}>
            {it.data.direction === 'out' ? 'sent' : 'received'}
          </Badge>
        </Group>
      );
    case 'stage':
      return (
        <Text fw={500} size="sm">
          Stage → {it.data.toStage.name ?? 'unknown'}
        </Text>
      );
    case 'activity':
      return (
        <Group gap={6}>
          <Text fw={500} size="sm" td={it.data.done ? 'line-through' : undefined}>
            {it.data.subject}
          </Text>
          <Badge size="xs" variant="light" tt="capitalize">
            {it.data.type}
          </Badge>
        </Group>
      );
  }
}

function bodyOf(it: Item): React.ReactNode {
  switch (it.kind) {
    case 'note':
      return <Text size="sm" mt={2} style={{ whiteSpace: 'pre-wrap' }}>{it.data.body}</Text>;
    case 'message':
      return it.data.snippet ? (
        <Text size="sm" mt={2} c="dimmed" lineClamp={2}>{it.data.snippet}</Text>
      ) : null;
    case 'stage':
      return it.data.fromStage ? (
        <Text size="sm" mt={2} c="dimmed">from {it.data.fromStage.name}</Text>
      ) : (
        <Text size="sm" mt={2} c="dimmed">deal created</Text>
      );
    case 'activity': {
      const a = it.data;
      const parts = a.participants.map((p) => p.name).join(', ');
      return (
        <Stack gap={0} mt={2}>
          {a.locationType === 'in_person' && a.location ? (
            <Text size="xs" c="dimmed">📍 {a.location}</Text>
          ) : null}
          {a.locationType === 'video' && a.conferenceUrl ? (
            <Text size="xs" c="blue" component="a" href={a.conferenceUrl} target="_blank">Join call</Text>
          ) : null}
          {parts ? <Text size="xs" c="dimmed">With {parts}</Text> : null}
        </Stack>
      );
    }
  }
}
