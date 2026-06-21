'use client';

import { NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { useCustomFields } from '@/lib/api/hooks';

export function CustomFieldsEditor({
  entity,
  values,
  onChange,
}: {
  entity: string;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const { data: fields = [] } = useCustomFields(entity);
  if (fields.length === 0) return null;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Custom fields
      </Text>
      {fields.map((f) => {
        const v = values?.[f.key];
        if (f.type === 'number') {
          return (
            <NumberInput
              key={f.id}
              label={f.label}
              value={(v as number | undefined) ?? ''}
              onChange={(val) => onChange(f.key, val === '' ? null : val)}
            />
          );
        }
        if (f.type === 'date') {
          return (
            <TextInput
              key={f.id}
              type="date"
              label={f.label}
              value={(v as string) ?? ''}
              onChange={(e) => onChange(f.key, e.currentTarget.value)}
            />
          );
        }
        if (f.type === 'select') {
          return (
            <Select
              key={f.id}
              label={f.label}
              data={f.options}
              value={(v as string) ?? null}
              onChange={(val) => onChange(f.key, val)}
              clearable
              searchable
            />
          );
        }
        return (
          <TextInput
            key={f.id}
            label={f.label}
            value={(v as string) ?? ''}
            onChange={(e) => onChange(f.key, e.currentTarget.value)}
          />
        );
      })}
    </Stack>
  );
}
