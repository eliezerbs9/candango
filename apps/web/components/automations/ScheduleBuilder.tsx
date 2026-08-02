'use client';

import { Chip, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import type { MarketingSchedule, ScheduleType } from '@/lib/api/email-automations';

const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: 'daily', label: 'Daily / every N days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly_date', label: 'Monthly — on a date' },
  { value: 'monthly_weekday', label: 'Monthly — on a weekday' },
  { value: 'once', label: 'One time' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_OPTIONS = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' },
  { value: '5', label: '5th' },
  { value: 'last', label: 'Last' },
];

const TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];

/** Builds a marketing schedule (all supported types) + the timezone it's evaluated in. */
export function ScheduleBuilder({
  value,
  onChange,
  timezone,
  onTimezoneChange,
}: {
  value: MarketingSchedule;
  onChange: (s: MarketingSchedule) => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}) {
  const set = (patch: Partial<MarketingSchedule>) => onChange({ ...value, ...patch });
  const atTime = value.atTime ?? '09:00';

  return (
    <Stack gap="sm">
      <Select
        label="Repeats"
        data={SCHEDULE_TYPES}
        value={value.type}
        onChange={(v) => set({ type: (v as ScheduleType) ?? 'daily' })}
        allowDeselect={false}
      />

      {value.type === 'daily' && (
        <NumberInput
          label="Every N days"
          min={1}
          max={365}
          value={value.everyDays ?? 1}
          onChange={(v) => set({ everyDays: Math.max(1, Number(v) || 1) })}
        />
      )}

      {value.type === 'weekly' && (
        <>
          <div>
            <Text size="sm" fw={500} mb={4}>
              On these days
            </Text>
            <Chip.Group
              multiple
              value={(value.daysOfWeek ?? []).map(String)}
              onChange={(vals) => set({ daysOfWeek: vals.map(Number).sort((a, b) => a - b) })}
            >
              <Group gap={6}>
                {WEEKDAYS.map((d, i) => (
                  <Chip key={i} value={String(i)} size="xs">
                    {d}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          </div>
          <NumberInput
            label="Every N weeks"
            min={1}
            max={52}
            value={value.everyWeeks ?? 1}
            onChange={(v) => set({ everyWeeks: Math.max(1, Number(v) || 1) })}
          />
        </>
      )}

      {value.type === 'monthly_date' && (
        <NumberInput
          label="Day of month"
          description="Short months use their last day (e.g. 31 → Feb 28)."
          min={1}
          max={31}
          value={value.dayOfMonth ?? 1}
          onChange={(v) => set({ dayOfMonth: Math.min(31, Math.max(1, Number(v) || 1)) })}
        />
      )}

      {value.type === 'monthly_weekday' && (
        <Group grow>
          <Select
            label="Which"
            data={WEEK_OPTIONS}
            value={String(value.week ?? '1')}
            onChange={(v) => set({ week: v === 'last' ? 'last' : Number(v ?? '1') })}
            allowDeselect={false}
          />
          <Select
            label="Weekday"
            data={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
            value={String(value.weekday ?? 1)}
            onChange={(v) => set({ weekday: Number(v ?? '1') })}
            allowDeselect={false}
          />
        </Group>
      )}

      {value.type === 'once' && (
        <TextInput
          label="On this date"
          type="date"
          value={value.date ?? ''}
          onChange={(e) => set({ date: e.currentTarget.value })}
        />
      )}

      <TextInput label="At time" type="time" value={atTime} onChange={(e) => set({ atTime: e.currentTarget.value })} />

      <Select
        label="Timezone"
        searchable
        data={TIMEZONES}
        value={timezone}
        onChange={(v) => onTimezoneChange(v ?? 'UTC')}
        allowDeselect={false}
      />
    </Stack>
  );
}
