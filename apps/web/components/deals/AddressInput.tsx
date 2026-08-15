'use client';

import { useState } from 'react';
import { Anchor, Button, Group, Paper, Text } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { AddressFields, type Address } from '@/components/deals/AddressFields';

/** One-line preview of an address. */
function summarize(v: Address): string {
  const a = v ?? {};
  const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(', ');
  return [a.line1, a.line2, cityLine, a.country].filter(Boolean).join(' · ');
}

/**
 * A clean, collapsed address editor: shows the address as a summary when set (with **Edit**), or an
 * **Add address** button when empty; expands to the shared address form (with Google Places
 * autocomplete). No "Name / attention" line — the entity that owns the address already has a name.
 */
export function AddressInput({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: Address;
  onChange: (v: Address) => void;
}) {
  const has = !!(value && (value.line1 || value.line2 || value.city || value.state || value.postalCode || value.country));
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <Text size="sm" fw={500} mb={4}>
        {label}
        {required ? ' *' : ''}
      </Text>

      {!editing && has && (
        <Paper withBorder radius="md" p="xs">
          <Group gap={8} wrap="nowrap" align="flex-start">
            <IconMapPin size={15} color="var(--mantine-color-gray-6)" style={{ marginTop: 2 }} />
            <Text size="sm" style={{ flex: 1 }}>
              {summarize(value)}
            </Text>
            <Anchor size="xs" onClick={() => setEditing(true)}>
              Edit
            </Anchor>
          </Group>
        </Paper>
      )}

      {!editing && !has && (
        <Button variant="light" size="xs" leftSection={<IconMapPin size={14} />} onClick={() => setEditing(true)}>
          Add address
        </Button>
      )}

      {editing && (
        <div>
          <AddressFields hideLabel withName={false} label={label} value={value} onChange={onChange} />
          <Group justify="flex-end" mt={4}>
            <Anchor size="xs" onClick={() => setEditing(false)}>
              Done
            </Anchor>
          </Group>
        </div>
      )}
    </div>
  );
}
