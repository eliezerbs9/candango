'use client';

import { useRef, useState } from 'react';
import { Autocomplete, Group, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import type { Address } from '@/lib/api/types';
import { getAddressParts, placesEnabled, suggestAddresses } from '@/lib/google/places';

export type { Address };

export function AddressFields({
  label,
  value,
  onChange,
  withName = true,
}: {
  label: string;
  value: Address;
  onChange: (v: Address) => void;
  withName?: boolean;
}) {
  const set = (k: keyof Address, val: string) => onChange({ ...value, [k]: val });

  const [options, setOptions] = useState<string[]>([]);
  const idByLabel = useRef<Map<string, string>>(new Map());

  const search = useDebouncedCallback(async (q: string) => {
    const sugg = await suggestAddresses(q);
    idByLabel.current = new Map(sugg.map((s) => [s.label, s.id]));
    setOptions(sugg.map((s) => s.label));
  }, 250);

  const onLine1Change = (v: string) => {
    set('line1', v);
    if (placesEnabled()) search(v);
  };

  const onPick = async (label: string) => {
    const id = idByLabel.current.get(label);
    if (!id) return;
    const parts = await getAddressParts(id);
    onChange({
      ...value,
      line1: parts?.line1 ?? label,
      city: parts?.city ?? value.city ?? '',
      state: parts?.state ?? value.state ?? '',
      postalCode: parts?.postalCode ?? value.postalCode ?? '',
      country: parts?.country ?? value.country ?? '',
    });
  };

  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      {withName && (
        <TextInput placeholder="Name / attention" value={value.name ?? ''} onChange={(e) => set('name', e.currentTarget.value)} />
      )}
      {placesEnabled() ? (
        <Autocomplete
          placeholder="Start typing an address…"
          value={value.line1 ?? ''}
          data={options}
          onChange={onLine1Change}
          onOptionSubmit={onPick}
          comboboxProps={{ withinPortal: true }}
        />
      ) : (
        <TextInput placeholder="Address line 1" value={value.line1 ?? ''} onChange={(e) => set('line1', e.currentTarget.value)} />
      )}
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
