'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Anchor, Badge, Button, Card, Checkbox, Group, Paper, Stack, Text, Textarea, ThemeIcon, Timeline } from '@mantine/core';
import { HintedScrollArea } from '@/components/common/HintedScrollArea';
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
  IconBolt,
  IconFileText,
  IconSignature,
} from '@tabler/icons-react';
import { ActivityForm } from '@/components/activities/ActivityForm';
import { ApiError } from '@/lib/api/client';
import {
  useActivities,
  useCreateNote,
  useDealEvents,
  useDealMessages,
  useNotes,
  useStageHistory,
  useUpdateActivity,
} from '@/lib/api/hooks';
import type { ApiActivity } from '@/lib/api/activities';
import type { ApiNote } from '@/lib/api/notes';
import type { ApiMessage } from '@/lib/api/messages';
import type { DealEvent, StageEvent } from '@/lib/api/deals';

type Item =
  | { kind: 'note'; date: Date; data: ApiNote }
  | { kind: 'activity'; date: Date; data: ApiActivity }
  | { kind: 'message'; date: Date; data: ApiMessage }
  | { kind: 'stage'; date: Date; data: StageEvent }
  | { kind: 'event'; date: Date; data: DealEvent };

const fmt = (d: Date) => d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function DealTimeline({ dealId, fill }: { dealId: string; fill?: boolean }) {
  const { data: activities = [] } = useActivities({ dealId });
  const { data: notes = [] } = useNotes(dealId);
  const { data: messages = [] } = useDealMessages(dealId);
  const { data: stages = [] } = useStageHistory(dealId);
  const { data: events = [] } = useDealEvents(dealId);
  const createNote = useCreateNote();
  const updateActivity = useUpdateActivity();
  const toggleActivity = (a: ApiActivity) => updateActivity.mutate({ id: a.id, done: !a.done });

  const [noteBody, setNoteBody] = useState('');
  const [actOpen, actCtl] = useDisclosure(false);
  const [editing, setEditing] = useState<ApiActivity | null>(null);
  const openNewActivity = () => {
    setEditing(null);
    actCtl.open();
  };
  const openEditActivity = (a: ApiActivity) => {
    setEditing(a);
    actCtl.open();
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    notes.forEach((n) => out.push({ kind: 'note', date: new Date(n.createdAt), data: n }));
    activities.forEach((a) =>
      out.push({ kind: 'activity', date: new Date(a.startAt ?? a.dueAt ?? a.createdAt), data: a }),
    );
    messages.forEach((m) => out.push({ kind: 'message', date: new Date(m.sentAt ?? m.createdAt), data: m }));
    stages.forEach((s) => out.push({ kind: 'stage', date: new Date(s.createdAt), data: s }));
    events.forEach((e) => out.push({ kind: 'event', date: new Date(e.createdAt), data: e }));
    return out.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [activities, notes, messages, stages, events]);

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

  const timeline = (
    <Timeline active={-1} bulletSize={26} lineWidth={2} pr="xs">
      {items.map((it) => (
        <Timeline.Item key={`${it.kind}-${itemKey(it)}`} bullet={bullet(it)} title={titleOf(it, toggleActivity, openEditActivity)}>
          <Text size="xs" c="dimmed">
            {fmt(it.date)}
          </Text>
          {bodyOf(it)}
        </Timeline.Item>
      ))}
    </Timeline>
  );

  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      style={fill ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}
    >
      <Stack gap="md" style={fill ? { flex: 1, minHeight: 0 } : undefined}>
      <Text fw={600}>Activity</Text>
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
            onClick={openNewActivity}
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
      ) : fill ? (
        // Desktop: fill the leftover column height (matched to the Details column) and scroll inside.
        <HintedScrollArea fill>{timeline}</HintedScrollArea>
      ) : (
        // Mobile: cap the height so a long history scrolls inside the card instead of stretching the page.
        <HintedScrollArea mah="clamp(360px, calc(100vh - 280px), 900px)">{timeline}</HintedScrollArea>
      )}

      <ActivityForm opened={actOpen} onClose={actCtl.close} defaultDealId={dealId} activity={editing} />
      </Stack>
    </Card>
  );
}

function itemKey(it: Item): string {
  return 'id' in it.data ? it.data.id : String(it.date.getTime());
}

function bullet(it: Item) {
  if (it.kind === 'event') {
    const icon =
      it.data.kind === 'proposal' ? <IconFileText size={14} /> : it.data.kind === 'signature' ? <IconSignature size={14} /> : it.data.kind === 'email' ? <IconMail size={14} /> : <IconBolt size={14} />;
    const c = it.data.kind === 'proposal' ? 'grape' : it.data.kind === 'signature' ? 'orange' : 'candango';
    return (
      <ThemeIcon size={26} radius="xl" variant="light" color={c}>
        {icon}
      </ThemeIcon>
    );
  }
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

function titleOf(
  it: Item,
  onToggleActivity: (a: ApiActivity) => void,
  onEditActivity: (a: ApiActivity) => void,
): React.ReactNode {
  switch (it.kind) {
    case 'note':
      return <Text fw={500} size="sm">Note · {it.data.authorName}</Text>;
    case 'message':
      return (
        <Group gap={6}>
          <Anchor component={Link} href={`/emails/${it.data.id}`} fw={500} size="sm">
            {it.data.subject || '(no subject)'}
          </Anchor>
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
        <Group gap={6} wrap="nowrap">
          <Checkbox
            size="xs"
            checked={it.data.done}
            onChange={() => onToggleActivity(it.data)}
            aria-label={it.data.done ? 'Mark not done' : 'Mark done'}
          />
          <Text
            fw={500}
            size="sm"
            td={it.data.done ? 'line-through' : undefined}
            style={{ cursor: 'pointer' }}
            onClick={() => onEditActivity(it.data)}
          >
            {it.data.subject}
          </Text>
          <Badge size="xs" variant="light" tt="capitalize">
            {it.data.type}
          </Badge>
        </Group>
      );
    case 'event':
      return (
        <Text fw={500} size="sm">
          {it.data.title}
          {it.data.actor ? <Text span c="dimmed" fw={400}> · {it.data.actor}</Text> : null}
        </Text>
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
    case 'event':
      return it.data.body ? (
        <Text size="sm" mt={2} c="dimmed">{it.data.body}</Text>
      ) : null;
  }
}
