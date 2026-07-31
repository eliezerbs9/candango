'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, Select, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { ApiError } from '@/lib/api/client';
import { useCompanies, useCreateActivity, useCreatePerson, useDeals, usePersons, useUpdateActivity, useUsers } from '@/lib/api/hooks';
import { useAuthStore } from '@/lib/auth/store';
import type { ActivityType, ApiActivity, LocationType } from '@/lib/api/activities';

/** Local date `YYYY-MM-DD` for today. */
const todayDate = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const TYPES: { value: ActivityType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
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
  const { data: companies = [] } = useCompanies();
  const { data: users = [] } = useUsers();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const create = useCreateActivity();
  const update = useUpdateActivity();
  const createPerson = useCreatePerson();

  const [type, setType] = useState<ActivityType>('task');
  const [subject, setSubject] = useState('');
  const [dealId, setDealId] = useState<string | null>(defaultDealId ?? null);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
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
      setAssignedUserId(activity.assignedUserId ?? currentUserId ?? null);
      setParticipantIds(activity.participants.map((p) => p.id));
      setDueAt(activity.dueAt ? activity.dueAt.slice(0, 10) : todayDate());
      setStartAt(activity.startAt ? toLocalDateTime(activity.startAt) : toLocalDateTime(new Date().toISOString()));
      setEndAt(activity.endAt ? toLocalDateTime(activity.endAt) : '');
      setLocationType(activity.locationType && activity.locationType !== 'none' ? activity.locationType : 'in_person');
      setLocation(activity.location ?? '');
      setConferenceUrl(activity.conferenceUrl ?? '');
    } else {
      setType('task');
      setSubject('');
      setDealId(defaultDealId ?? null);
      setAssignedUserId(currentUserId ?? null);
      setParticipantIds([]);
      // Dates default to today/now and are required — no dateless activities.
      setDueAt(todayDate());
      setStartAt(toLocalDateTime(new Date().toISOString()));
      setEndAt('');
      setLocationType('in_person');
      setLocation('');
      setConferenceUrl('');
    }
  }, [opened, activity, defaultDealId, currentUserId]);

  // Only meetings are timed calendar events; calls/tasks/emails are to-dos with a due date
  // (calls sync to Google Tasks, not Calendar).
  const timed = type === 'meeting';
  // When opened from a deal (defaultDealId set), the deal is fixed — hide the picker.
  const lockedDeal = Boolean(defaultDealId);

  // Participants = the deal's people (its primary contact + everyone at the
  // deal's company) plus anyone already selected. New people are creatable inline.
  const selectedDeal = deals.find((d) => d.id === dealId);
  const dealCompany = companies.find((c) => c.id === selectedDeal?.companyId);
  const dealPersonIds = new Set<string>();
  if (selectedDeal?.primaryPersonId) dealPersonIds.add(selectedDeal.primaryPersonId);
  dealCompany?.contacts.forEach((c) => dealPersonIds.add(c.id));
  const participantOptions = [...new Set([...dealPersonIds, ...participantIds])].map((id) => ({
    value: id,
    label: persons.find((p) => p.id === id)?.name ?? 'Unknown',
  }));

  const submit = () => {
    if (!subject.trim()) {
      notifications.show({ message: 'Subject is required', color: 'red' });
      return;
    }
    if ((timed && !startAt) || (!timed && !dueAt)) {
      notifications.show({ message: timed ? 'Start is required' : 'Due date is required', color: 'red' });
      return;
    }
    const body = {
      type,
      subject: subject.trim(),
      dealId: dealId ?? undefined,
      assignedUserId: assignedUserId ?? undefined,
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

        {!lockedDeal && (
          <Select
            label="Deal"
            placeholder="Link to a deal (optional)"
            data={deals.map((d) => ({ value: d.id, label: d.title }))}
            value={dealId}
            onChange={setDealId}
            searchable
            clearable
          />
        )}
        <Select
          label="Assignee"
          data={users.map((u) => ({ value: u.id, label: u.name || u.email }))}
          value={assignedUserId}
          onChange={setAssignedUserId}
          searchable
          allowDeselect={false}
        />
        <CreatableMultiSelect
          label="Participants"
          placeholder={dealId ? "The deal's people" : 'Search or create people'}
          options={participantOptions}
          value={participantIds}
          onChange={setParticipantIds}
          onCreate={async (name) => {
            const link = dealCompany
              ? window.confirm(`Also add ${name} as a contact of ${dealCompany.name}?`)
              : false;
            const p = await createPerson.mutateAsync(link ? { name, companyIds: [dealCompany!.id] } : { name });
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
