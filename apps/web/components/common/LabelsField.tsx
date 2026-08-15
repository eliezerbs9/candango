'use client';

import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Text } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import { CreatableSelect } from '@/components/common/CreatableSelect';

/**
 * Labels as **pills** with a **discrete add** control: existing labels show as removable badges;
 * clicking **Add labels** reveals a small search/create selector (type to filter workspace labels or
 * create a new one). Adds one at a time; ✕ closes the selector.
 */
export function LabelsField({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const add = (t: string | null) => {
    const v = t?.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  return (
    <Group gap={6} align="center">
      {value.length === 0 && !adding && (
        <Text size="sm" c="dimmed">
          No labels
        </Text>
      )}
      {value.map((t) => (
        <Badge
          key={t}
          variant="light"
          color="gray"
          size="lg"
          tt="none"
          style={{ fontWeight: 500 }}
          rightSection={
            <ActionIcon size="xs" variant="transparent" color="gray" aria-label={`Remove ${t}`} onClick={() => remove(t)}>
              <IconX size={12} />
            </ActionIcon>
          }
        >
          {t}
        </Badge>
      ))}

      {adding ? (
        <Group gap={4} wrap="nowrap" style={{ minWidth: 200 }}>
          <div style={{ flex: 1 }}>
            <CreatableSelect
              label=""
              placeholder="Search or create a label"
              openOnFocus
              options={options.filter((o) => !value.includes(o)).map((o) => ({ value: o, label: o }))}
              value={null}
              onChange={add}
              onCreate={async (name) => {
                add(name);
                return { value: name.trim(), label: name.trim() };
              }}
            />
          </div>
          <ActionIcon variant="subtle" color="gray" aria-label="Done" onClick={() => setAdding(false)}>
            <IconX size={15} />
          </ActionIcon>
        </Group>
      ) : (
        <Button variant="subtle" size="xs" leftSection={<IconPlus size={13} />} onClick={() => setAdding(true)}>
          Add labels
        </Button>
      )}
    </Group>
  );
}
