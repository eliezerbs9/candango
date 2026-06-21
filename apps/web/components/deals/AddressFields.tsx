'use client';

import { Group, Stack, Text, TextInput } from '@mantine/core';

export type Address = Record<string, string>;

export function AddressFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Address;
  onChange: (v: Address) => void;
}) {
  const set = (k: string, val: string) => onChange({ ...value, [k]: val });
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <TextInput placeholder="Name / attention" value={value.name ?? ''} onChange={(e) => set('name', e.currentTarget.value)} />
      <TextInput placeholder="Address line 1" value={value.line1 ?? ''} onChange={(e) => set('line1', e.currentTarget.value)} />
      <TextInput placeholder="Address line 2" value={value.line2 ?? ''} onChange={(e) => set('line2', e.currentTarget.value)} />
      <Group grow>
        <TextInput placeholder="City" value={value.city ?? ''} onChange={(e) => set('city', e.currentTarget.value)} />
        <TextInput placeholder="State / region" value={value.state ?? ''} onChange={(e) => set('state', e.currentTarget.value)} />
      </Group>
      <Group grow>
        <TextInput placeholder="Postal code" value={value.postalCode ?? ''} onChange={(e) => set('postalCode', e.currentTarget.value)} />
        <TextInput placeholder="Country" value={value.country ?? ''} onChange={(e) => set('country', e.currentTarget.value)} />
      </Group>
    </Stack>
  );
}
