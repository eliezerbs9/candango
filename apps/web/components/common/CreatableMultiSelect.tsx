'use client';

import { useState } from 'react';
import {
  Combobox,
  Group,
  Pill,
  PillsInput,
  Text,
  useCombobox,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

export interface Option {
  value: string;
  label: string;
}

/**
 * Multi-value select you type into: filters existing options, lets you pick
 * several (shown as pills), and offers "+ Create '<text>'" when nothing matches.
 * Used for the many-to-many person↔company links.
 */
export function CreatableMultiSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  onCreate,
}: {
  label: string;
  placeholder?: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  onCreate: (name: string) => Promise<Option>;
}) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
  });
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [extra, setExtra] = useState<Option[]>([]);

  const all = [...options, ...extra.filter((e) => !options.some((o) => o.value === e.value))];
  const labelOf = (id: string) => all.find((o) => o.value === id)?.label ?? id;

  const query = search.trim();
  const filtered = query
    ? all.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : all;
  const exactMatch = all.some((o) => o.label.toLowerCase() === query.toLowerCase());

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await onCreate(query);
      setExtra((prev) => [...prev, created]);
      onChange([...value, created.value]);
      setSearch('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === '$create') {
          void handleCreate();
          return;
        }
        onChange(value.includes(val) ? value.filter((v) => v !== val) : [...value, val]);
        setSearch('');
      }}
    >
      <Combobox.DropdownTarget>
        <PillsInput label={label} onClick={() => combobox.openDropdown()}>
          <Pill.Group>
            {value.map((id) => (
              <Pill key={id} withRemoveButton onRemove={() => remove(id)}>
                {labelOf(id)}
              </Pill>
            ))}
            <Combobox.EventsTarget>
              <PillsInput.Field
                value={search}
                placeholder={value.length === 0 ? placeholder : undefined}
                onFocus={() => combobox.openDropdown()}
                onChange={(e) => {
                  combobox.openDropdown();
                  combobox.updateSelectedOptionIndex();
                  setSearch(e.currentTarget.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && search.length === 0 && value.length > 0) {
                    e.preventDefault();
                    remove(value[value.length - 1]);
                  }
                }}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          {filtered.map((o) => (
            <Combobox.Option value={o.value} key={o.value} active={value.includes(o.value)}>
              <Group gap="sm" wrap="nowrap">
                <Text size="sm">{o.label}</Text>
                {value.includes(o.value) ? (
                  <Text size="xs" c="dimmed">
                    ✓
                  </Text>
                ) : null}
              </Group>
            </Combobox.Option>
          ))}
          {query && !exactMatch ? (
            <Combobox.Option value="$create" disabled={creating}>
              <Group gap={6} wrap="nowrap">
                <IconPlus size={14} />
                <Text size="sm">
                  Create “<b>{query}</b>”
                </Text>
              </Group>
            </Combobox.Option>
          ) : null}
          {filtered.length === 0 && !query ? (
            <Combobox.Empty>Type to search or create</Combobox.Empty>
          ) : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
