'use client';

import { useEffect, useState } from 'react';
import {
  CloseButton,
  Combobox,
  Group,
  InputBase,
  Loader,
  Text,
  useCombobox,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

export interface Option {
  value: string;
  label: string;
}

/**
 * A select you type directly into: it filters existing options as you type,
 * and when nothing matches the typed text it offers "+ Create '<text>'".
 * Picking that calls `onCreate`, which returns the new option — selected
 * immediately, without leaving the form. There is no separate search box;
 * the field itself is the input.
 */
export function CreatableSelect({
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
  value: string | null;
  onChange: (value: string | null) => void;
  onCreate: (name: string) => Promise<Option>;
}) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [creating, setCreating] = useState(false);
  // Locally-created options live here so they show instantly, before the list refetches.
  const [extra, setExtra] = useState<Option[]>([]);

  const all = [...options, ...extra.filter((e) => !options.some((o) => o.value === e.value))];
  const selectedLabel = all.find((o) => o.value === value)?.label ?? '';

  // The field shows the typed text while searching, and the selected label otherwise.
  const [search, setSearch] = useState(selectedLabel);
  useEffect(() => {
    setSearch(selectedLabel);
  }, [selectedLabel]);

  const query = search.trim();
  const filtered = query
    ? all.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : all;
  const exactMatch = all.some((o) => o.label.toLowerCase() === query.toLowerCase());

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await onCreate(query);
      setExtra((prev) => [...prev, created]);
      onChange(created.value);
      setSearch(created.label);
      combobox.closeDropdown();
    } finally {
      setCreating(false);
    }
  }

  const optionNodes = filtered.map((o) => (
    <Combobox.Option value={o.value} key={o.value}>
      {o.label}
    </Combobox.Option>
  ));

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === '$create') {
          void handleCreate();
          return;
        }
        const opt = all.find((o) => o.value === val);
        onChange(val);
        setSearch(opt?.label ?? '');
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          label={label}
          placeholder={placeholder}
          value={search}
          rightSection={
            creating ? (
              <Loader size="xs" />
            ) : value ? (
              <CloseButton
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(null);
                  setSearch('');
                }}
                aria-label="Clear"
              />
            ) : (
              <Combobox.Chevron />
            )
          }
          rightSectionPointerEvents={value && !creating ? 'all' : 'none'}
          onChange={(e) => {
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
            setSearch(e.currentTarget.value);
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            combobox.closeDropdown();
            setSearch(selectedLabel);
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {optionNodes.length > 0 ? optionNodes : null}
          {query && !exactMatch ? (
            <Combobox.Option value="$create">
              <Group gap={6} wrap="nowrap">
                <IconPlus size={14} />
                <Text size="sm">
                  Create “<b>{query}</b>”
                </Text>
              </Group>
            </Combobox.Option>
          ) : null}
          {optionNodes.length === 0 && !query ? (
            <Combobox.Empty>Type to search or create</Combobox.Empty>
          ) : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
