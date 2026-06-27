'use client';

import { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css';
import Link from 'next/link';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Center,
  Checkbox,
  Group,
  HoverCard,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCloudCheck,
  IconCloudOff,
  IconMapPin,
  IconPlus,
  IconVideo,
} from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { ActivityForm } from '@/components/activities/ActivityForm';
import { useActivities, useCompleteActivity, useGoogleStatus } from '@/lib/api/hooks';
import type { ActivityType, ApiActivity } from '@/lib/api/activities';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
});

// Meetings are timed events (brand terracotta); calls/tasks are to-dos (blue); email kept distinct (teal).
const TYPE_COLORS: Record<ActivityType, string> = {
  call: 'blue',
  meeting: 'candango',
  task: 'blue',
  email: 'teal',
};

type Mode = 'month' | 'week' | 'day' | 'list';

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: ApiActivity;
}

/** Nav-only toolbar (the Month/Week/Day/List switcher lives in the page header). */
function CalToolbar({ label, onNavigate }: { label: string; onNavigate: (a: 'PREV' | 'NEXT' | 'TODAY') => void }) {
  return (
    <Group justify="space-between" mb="sm">
      <Group gap="xs">
        <Button size="xs" variant="default" onClick={() => onNavigate('TODAY')}>
          Today
        </Button>
        <ActionIcon variant="default" onClick={() => onNavigate('PREV')} aria-label="Previous">
          <IconChevronLeft size={16} />
        </ActionIcon>
        <ActionIcon variant="default" onClick={() => onNavigate('NEXT')} aria-label="Next">
          <IconChevronRight size={16} />
        </ActionIcon>
      </Group>
      <Text fw={600}>{label}</Text>
      <span style={{ width: 80 }} />
    </Group>
  );
}

/** Parse the date part of an ISO string as LOCAL midnight (avoids the UTC→local day shift). */
function dateOnlyLocal(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function whenLabel(a: ApiActivity) {
  if (a.startAt) return new Date(a.startAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  if (a.dueAt) return `Due ${a.dueAt.slice(0, 10)}`;
  return '—';
}

export default function ActivitiesPage() {
  const { data: items = [], isLoading } = useActivities({ assignee: 'me' });
  const complete = useCompleteActivity();
  const gs = useGoogleStatus();
  const calConnected = gs.data?.calendar?.status === 'connected';
  const [opened, ctl] = useDisclosure(false);
  const [editing, setEditing] = useState<ApiActivity | null>(null);
  const [mode, setMode] = useState<Mode>('month');
  const [date, setDate] = useState(new Date());

  const openNew = () => {
    setEditing(null);
    ctl.open();
  };
  const openEdit = (a: ApiActivity) => {
    setEditing(a);
    ctl.open();
  };

  const events = useMemo<CalEvent[]>(
    () =>
      items.flatMap((a) => {
        // Tasks carry a date-only `dueAt` (stored as UTC midnight). Render it on that
        // calendar date in LOCAL time — `new Date(iso)` would shift it a day in negative offsets.
        const start = a.startAt ? new Date(a.startAt) : a.dueAt ? dateOnlyLocal(a.dueAt) : null;
        if (!start) return [];
        const end = a.endAt ? new Date(a.endAt) : start;
        return [{ id: a.id, title: a.subject, start, end, allDay: !a.startAt, resource: a }];
      }),
    [items],
  );

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
        subtitle="Calendar of your tasks, calls and meetings"
        actions={
          <Group>
            <HoverCard width={250} shadow="md" position="bottom-end" withArrow openDelay={120}>
              <HoverCard.Target>
                <ThemeIcon variant="subtle" color={calConnected ? 'teal' : 'gray'} size="sm" style={{ cursor: 'help' }}>
                  {calConnected ? <IconCloudCheck size={17} /> : <IconCloudOff size={17} />}
                </ThemeIcon>
              </HoverCard.Target>
              <HoverCard.Dropdown>
                {calConnected ? (
                  <Text size="xs" c="dimmed">
                    Synced two-way with your Google Calendar.
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    Not synced to Google.{' '}
                    <Anchor component={Link} href="/settings/integrations" size="xs">
                      Connect
                    </Anchor>{' '}
                    to sync two-way. Activities still work here without it.
                  </Text>
                )}
              </HoverCard.Dropdown>
            </HoverCard>
            <SegmentedControl
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              data={[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
                { value: 'day', label: 'Day' },
                { value: 'list', label: 'List' },
              ]}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
              New activity
            </Button>
          </Group>
        }
      />

      {mode === 'list' ? (
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
                    <Text
                      fw={500}
                      td={a.done ? 'line-through' : undefined}
                      c={a.done ? 'dimmed' : undefined}
                      style={{ cursor: 'pointer' }}
                      onClick={() => openEdit(a)}
                    >
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
      ) : (
        <div style={{ height: '85vh', minHeight: 760 }}>
          <Calendar
            localizer={localizer}
            events={events}
            view={mode as View}
            onView={(v) => setMode(v as Mode)}
            date={date}
            onNavigate={setDate}
            views={['month', 'week', 'day']}
            components={{ toolbar: CalToolbar }}
            popup
            onSelectEvent={(e: CalEvent) => openEdit(e.resource)}
            eventPropGetter={(e: CalEvent) => {
              const c = TYPE_COLORS[e.resource.type];
              return {
                style: {
                  backgroundColor: `var(--mantine-color-${c}-1)`,
                  color: `var(--mantine-color-${c}-9)`,
                  border: `1px solid var(--mantine-color-${c}-2)`,
                  borderLeft: `3px solid var(--mantine-color-${c}-4)`,
                },
              };
            }}
            style={{ height: '100%' }}
          />
        </div>
      )}

      <ActivityForm opened={opened} onClose={ctl.close} activity={editing} />
    </>
  );
}
