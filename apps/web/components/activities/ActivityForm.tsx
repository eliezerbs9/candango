'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, Select, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { ApiError } from '@/lib/api/client';
import { useCreateActivity, useCreatePerson, useDeals, usePersons, useUpdateActivity } from '@/lib/api/hooks';
import type { ActivityType, ApiActivity, LocationType } from '@/lib/api/activities';

const TYPES: { value: ActivityType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
];

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'in_person', label: 'In person' },
  { value: 'video', label: 'Video' },
  { value: 'phone', label: 'Phone' },
];

/** Local datetime-local / date string → full ISO (or undefined). */
const toIso = (v: string) => (v ? new Date(v).toISOString() : undefined);

/** ISO → local `YYYY-MM-DDTHH:mm` for a datetime-local input. */
const toLocalDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ActivityForm({
  opened,
  onClose,
  defaultDealId,
  activity,
}: {
  opened: boolean;
  onClose: () => void;
  defaultDealId?: string;
  activity?: ApiActivity | null;
}) {
  const { data: deals = [] } = useDeals();
  const { data: persons = [] } = usePersons();
  const create = useCreateActivity();
  const update = useUpdateActivity();
  const createPerson = useCreatePerson();

  const [type, setType] = useState<ActivityType>('task');
  const [subject, setSubject] = useState('');
  const [dealId, setDealId] = useState<string | null>(defaultDealId ?? null);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('in_person');
  const [location, setLocation] = useState('');
  const [conferenceUrl, setConferenceUrl] = useState('');

  useEffect(() => {
    if (!opened) return;
    if (activity) {
      setType(activity.type);
      setSubject(activity.subject);
      setDealId(activity.dealId);
      setParticipantIds(activity.participants.map((p) => p.id));
      setDueAt(activity.dueAt ? activity.dueAt.slice(0, 10) : '');
      setStartAt(activity.startAt ? toLocalDateTime(activity.startAt) : '');
      setEndAt(activity.endAt ? toLocalDateTime(activity.endAt) : '');
      setLocationType(activity.locationType && activity.locationType !== 'none' ? activity.locationType : 'in_person');
      setLocation(activity.location ?? '');
      setConferenceUrl(activity.conferenceUrl ?? '');
    } else {
      setType('task');
      setSubject('');
      setDealId(defaultDealId ?? null);
      setParticipantIds([]);
      setDueAt('');
      setStartAt('');
      setEndAt('');
      setLocationType('in_person');
      setLocation('');
      setConferenceUrl('');
    }
  }, [opened, activity, defaultDealId]);

  const timed = type === 'meeting' || type === 'call';

  const submit = () => {
    if (!subject.trim()) {
      notifications.show({ message: 'Subject is required', color: 'red' });
      return;
    }
    const body = {
      type,
      subject: subject.trim(),
      dealId: dealId ?? undefined,
      // Empty → let the API default participants to the deal's people.
      participantIds: participantIds.length ? participantIds : undefined,
      dueAt: !timed ? toIso(dueAt) : undefined,
      startAt: timed ? toIso(startAt) : undefined,
      endAt: timed ? toIso(endAt) : undefined,
      locationType: timed ? locationType : undefined,
      location: timed && locationType === 'in_person' ? location || undefined : undefined,
      conferenceUrl: timed && locationType === 'video' ? conferenceUrl || undefined : undefined,
    };
    const handlers = {
      onSuccess: () => {
        notifications.show({ message: activity ? 'Activity updated' : 'Activity created', color: 'green' });
        onClose();
      },
      onError: (e: unknown) =>
        notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
    };
    if (activity) update.mutate({ id: activity.id, ...body }, handlers);
    else create.mutate(body, handlers);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={activity ? 'Edit activity' : 'New activity'}>
      <Stack>
        <Select
          label="Type"
          data={TYPES}
          value={type}
          onChange={(v) => setType((v as ActivityType) ?? 'task')}
          allowDeselect={false}
        />
        <TextInput label="Subject" required value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />

        <Select
          label="Deal"
          placeholder="Link to a deal (optional)"
          data={deals.map((d) => ({ value: d.id, label: d.title }))}
          value={dealId}
          onChange={setDealId}
          searchable
          clearable
        />
        <CreatableMultiSelect
          label="Participants"
          placeholder={dealId ? "Defaults to the deal's people" : 'Search or create people'}
          options={persons.map((p) => ({ value: p.id, label: p.name }))}
          value={participantIds}
          onChange={setParticipantIds}
          onCreate={async (name) => {
            const p = await createPerson.mutateAsync({ name });
            return { value: p.id, label: p.name };
          }}
        />

        {timed ? (
          <>
            <TextInput
              type="datetime-local"
              label="Start"
              value={startAt}
              onChange={(e) => setStartAt(e.currentTarget.value)}
            />
            <TextInput
              type="datetime-local"
              label="End"
              value={endAt}
              onChange={(e) => setEndAt(e.currentTarget.value)}
            />
            <Select
              label="Location"
              data={LOCATION_TYPES}
              value={locationType}
              onChange={(v) => setLocationType((v as LocationType) ?? 'in_person')}
              allowDeselect={false}
            />
            {locationType === 'in_person' ? (
              <TextInput
                label="Address"
                placeholder="Where you'll meet"
                value={location}
                onChange={(e) => setLocation(e.currentTarget.value)}
              />
            ) : null}
            {locationType === 'video' ? (
              <TextInput
                label="Meeting link"
                placeholder="https://…"
                value={conferenceUrl}
                onChange={(e) => setConferenceUrl(e.currentTarget.value)}
              />
            ) : null}
          </>
        ) : (
          <TextInput
            type="date"
            label="Due date"
            value={dueAt}
            onChange={(e) => setDueAt(e.currentTarget.value)}
          />
        )}

        <Button onClick={submit} loading={create.isPending || update.isPending}>
          {activity ? 'Save changes' : 'Create activity'}
        </Button>
      </Stack>
    </Modal>
  );
}
